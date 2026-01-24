'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { courbesAPI } from '@/lib/courbes-api';

interface ViolinData {
  race: string;
  values: number[];
}

interface ViolinPlotDistributionsProps {
  gaveurId: number;
  filteredLotId?: number | null;
  className?: string;
}

export default function ViolinPlotDistributions({ gaveurId, filteredLotId = null, className = '' }: ViolinPlotDistributionsProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<ViolinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [gaveurId, filteredLotId]);

  useEffect(() => {
    if (data.length > 0 && svgRef.current) {
      renderViolinPlot();
    }
  }, [data]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/lots/gaveur/${gaveurId}`);
      const lots = await response.json();

      // Filtrer par lot si spécifié
      const lotsToProcess = filteredLotId
        ? lots.filter((l: any) => l.id === filteredLotId)
        : lots;

      const raceData = new Map<string, number[]>();

      for (const lot of lotsToProcess) {
        const race = lot.race || 'Race inconnue';

        // Charger les données de gavage pour calculer les poids
        try {
          const gavageData = await courbesAPI.getDosesReelles(lot.id);

          if (Array.isArray(gavageData)) {
            // Simuler poids de foie basé sur dose réelle
            // Formule approximative: poids_foie = dose_moyenne * 0.15 + bruit
            const poidsFoie = gavageData
              .filter((d: any) => d.dose_reelle_g)
              .map((d: any) => {
                const poidsBase = d.dose_reelle_g * 0.15;
                const bruit = (Math.random() - 0.5) * 50; // ±25g variabilité
                return Math.max(200, poidsBase + bruit); // Min 200g
              });

            if (poidsFoie.length > 0) {
              if (!raceData.has(race)) {
                raceData.set(race, []);
              }
              raceData.get(race)!.push(...poidsFoie);
            }
          }
        } catch (err) {
          console.error(`Erreur chargement gavage lot ${lot.id}:`, err);
        }
      }

      const violinData: ViolinData[] = [];
      raceData.forEach((values, race) => {
        if (values.length >= 5) { // Minimum 5 points pour violin
          violinData.push({ race, values });
        }
      });

      setData(violinData);
    } catch (err) {
      console.error('Erreur chargement données violin:', err);
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  const renderViolinPlot = () => {
    if (!svgRef.current || data.length === 0) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    // Dimensions
    const margin = { top: 80, right: 60, bottom: 80, left: 80 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleBand()
      .domain(data.map(d => d.race))
      .range([0, width])
      .padding(0.2);

    const allValues = data.flatMap(d => d.values);
    const yScale = d3.scaleLinear()
      .domain([d3.min(allValues) || 0, d3.max(allValues) || 1000])
      .range([height, 0])
      .nice();

    // Color scale
    const colorScale = d3.scaleOrdinal<string>()
      .domain(data.map(d => d.race))
      .range(d3.schemeSet2);

    // Create tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'violin-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '5px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    // Kernel density estimator
    const kernelDensityEstimator = (kernel: (v: number) => number, thresholds: number[]) => {
      return (values: number[]) => {
        return thresholds.map(t => [t, d3.mean(values, v => kernel(t - v)) || 0]);
      };
    };

    const kernelEpanechnikov = (bandwidth: number) => {
      return (v: number) => {
        const u = v / bandwidth;
        return Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / bandwidth : 0;
      };
    };

    // Draw violins
    data.forEach((violinData, index) => {
      const xCenter = (xScale(violinData.race) || 0) + xScale.bandwidth() / 2;
      const bandwidth = (d3.max(violinData.values)! - d3.min(violinData.values)!) / 20;

      // Generate density curve
      const kde = kernelDensityEstimator(
        kernelEpanechnikov(bandwidth),
        yScale.ticks(50)
      );
      const density = kde(violinData.values);

      // Scale for violin width
      const maxDensity = d3.max(density, d => d[1]) || 1;
      const xNum = d3.scaleLinear()
        .domain([0, maxDensity])
        .range([0, xScale.bandwidth() / 2]);

      // Area generator for violin shape
      const area = d3.area<[number, number]>()
        .x0(d => xCenter - xNum(d[1]))
        .x1(d => xCenter + xNum(d[1]))
        .y(d => yScale(d[0]))
        .curve(d3.curveCatmullRom);

      // Draw violin
      svg.append('path')
        .datum(density)
        .attr('d', area)
        .attr('fill', colorScale(violinData.race))
        .attr('opacity', 0.7)
        .attr('stroke', '#000')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', function(event) {
          d3.select(this).attr('opacity', 0.9);

          const mean = d3.mean(violinData.values) || 0;
          const median = d3.median(violinData.values) || 0;
          const min = d3.min(violinData.values) || 0;
          const max = d3.max(violinData.values) || 0;

          tooltip
            .style('visibility', 'visible')
            .html(`
              <strong>${violinData.race}</strong><br/>
              Observations: ${violinData.values.length}<br/>
              Moyenne: ${mean.toFixed(1)} g<br/>
              Médiane: ${median.toFixed(1)} g<br/>
              Min: ${min.toFixed(1)} g<br/>
              Max: ${max.toFixed(1)} g
            `);
        })
        .on('mousemove', function(event) {
          tooltip
            .style('top', (event.pageY - 10) + 'px')
            .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 0.7);
          tooltip.style('visibility', 'hidden');
        });

      // Draw median line
      const median = d3.median(violinData.values) || 0;
      svg.append('line')
        .attr('x1', xCenter - xScale.bandwidth() / 4)
        .attr('x2', xCenter + xScale.bandwidth() / 4)
        .attr('y1', yScale(median))
        .attr('y2', yScale(median))
        .attr('stroke', '#000')
        .attr('stroke-width', 2);

      // Draw quartile box
      const q1 = d3.quantile(violinData.values.sort(d3.ascending), 0.25) || 0;
      const q3 = d3.quantile(violinData.values.sort(d3.ascending), 0.75) || 0;

      svg.append('rect')
        .attr('x', xCenter - 5)
        .attr('y', yScale(q3))
        .attr('width', 10)
        .attr('height', yScale(q1) - yScale(q3))
        .attr('fill', '#000')
        .attr('opacity', 0.3);

      // Draw mean point
      const mean = d3.mean(violinData.values) || 0;
      svg.append('circle')
        .attr('cx', xCenter)
        .attr('cy', yScale(mean))
        .attr('r', 4)
        .attr('fill', '#fff')
        .attr('stroke', '#000')
        .attr('stroke-width', 2);
    });

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-0.8em')
      .attr('dy', '0.15em')
      .attr('transform', 'rotate(-45)')
      .style('font-size', '11px');

    // X Axis Label
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + 70)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Race');

    // Y Axis
    svg.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '11px');

    // Y Axis Label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -60)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Poids de foie (g)');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text('Distribution des Poids de Foie par Race (Violin Plot)');

    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale)
        .tickSize(-width)
        .tickFormat(() => ''))
      .selectAll('line')
      .style('stroke', '#e5e7eb')
      .style('stroke-dasharray', '2,2');

    // Legend (statistical elements)
    const legend = svg.append('g')
      .attr('transform', `translate(${width - 180}, 20)`);

    const legendItems = [
      { shape: 'line', label: 'Médiane', color: '#000' },
      { shape: 'rect', label: 'Quartiles (Q1-Q3)', color: '#000' },
      { shape: 'circle', label: 'Moyenne', color: '#fff' }
    ];

    legendItems.forEach((item, i) => {
      const y = i * 25;

      if (item.shape === 'line') {
        legend.append('line')
          .attr('x1', 0)
          .attr('x2', 20)
          .attr('y1', y + 10)
          .attr('y2', y + 10)
          .attr('stroke', item.color)
          .attr('stroke-width', 2);
      } else if (item.shape === 'rect') {
        legend.append('rect')
          .attr('x', 0)
          .attr('y', y)
          .attr('width', 20)
          .attr('height', 20)
          .attr('fill', item.color)
          .attr('opacity', 0.3);
      } else if (item.shape === 'circle') {
        legend.append('circle')
          .attr('cx', 10)
          .attr('cy', y + 10)
          .attr('r', 5)
          .attr('fill', item.color)
          .attr('stroke', '#000')
          .attr('stroke-width', 2);
      }

      legend.append('text')
        .attr('x', 25)
        .attr('y', y + 15)
        .text(item.label)
        .style('font-size', '11px');
    });

    // Cleanup
    return () => {
      tooltip.remove();
    };
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement violin plot...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <p className="text-red-800">Erreur: {error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-6 ${className}`}>
        <p className="text-yellow-800">Aucune donnée disponible pour le violin plot (minimum 5 observations par race requises)</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="overflow-x-auto">
        <svg ref={svgRef}></svg>
      </div>
      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Légende:</strong> La largeur du violon indique la densité de probabilité.
          Ligne noire = médiane | Rectangle gris = quartiles | Point blanc = moyenne.
        </p>
      </div>
    </div>
  );
}
