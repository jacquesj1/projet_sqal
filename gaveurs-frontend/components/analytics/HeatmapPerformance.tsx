'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { courbesAPI } from '@/lib/courbes-api';

interface HeatmapData {
  jour: number;
  lot_id: number;
  lot_nom: string;
  ecart_percent: number;
}

interface HeatmapPerformanceProps {
  gaveurId: number;
  filteredLotId?: number | null;
  className?: string;
}

export default function HeatmapPerformance({ gaveurId, filteredLotId = null, className = '' }: HeatmapPerformanceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [gaveurId, filteredLotId]);

  useEffect(() => {
    if (data.length > 0 && svgRef.current) {
      renderHeatmap();
    }
  }, [data]);

  const [totalLots, setTotalLots] = useState(0);
  const [lotsWithData, setLotsWithData] = useState(0);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/lots/gaveur/${gaveurId}`);
      const lots = await response.json();

      // Filtrer par lot si spécifié, sinon prendre TOUS les lots
      const lotsToProcess = filteredLotId
        ? lots.filter((l: any) => l.id === filteredLotId)
        : lots; // Prendre tous les lots, pas seulement les 10 premiers

      setTotalLots(lotsToProcess.length);

      // Pour chaque lot, charger les données de gavage
      const heatmapData: HeatmapData[] = [];
      let lotsWithDataCount = 0;

      for (const lot of lotsToProcess) {
        try {
          const gavageData = await courbesAPI.getDosesReelles(lot.id);

          if (Array.isArray(gavageData) && gavageData.length > 0) {
            lotsWithDataCount++;
            gavageData.forEach((entry: any) => {
              if (entry.jour_gavage && entry.dose_theorique_g && entry.dose_reelle_g) {
                const ecart = ((entry.dose_reelle_g - entry.dose_theorique_g) / entry.dose_theorique_g) * 100;
                heatmapData.push({
                  jour: entry.jour_gavage,
                  lot_id: lot.id,
                  lot_nom: lot.code_lot || lot.nom || `Lot ${lot.id}`,
                  ecart_percent: ecart,
                });
              }
            });
          }
        } catch (err) {
          console.error(`Erreur chargement lot ${lot.id}:`, err);
        }
      }

      setLotsWithData(lotsWithDataCount);
      setData(heatmapData);
    } catch (err) {
      console.error('Erreur chargement données heatmap:', err);
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  const renderHeatmap = () => {
    if (!svgRef.current || data.length === 0) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    // Dimensions
    const margin = { top: 80, right: 120, bottom: 60, left: 120 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get unique values
    const jours = Array.from(new Set(data.map(d => d.jour))).sort((a, b) => a - b);
    const lots = Array.from(new Set(data.map(d => d.lot_nom))).sort();

    // Scales
    const xScale = d3.scaleBand()
      .domain(jours.map(String))
      .range([0, width])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(lots)
      .range([0, height])
      .padding(0.05);

    // Color scale: -20% (red) to 0% (yellow) to +20% (green)
    const colorScale = d3.scaleSequential()
      .domain([-20, 20])
      .interpolator(d3.interpolateRdYlGn);

    // Create tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'heatmap-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '5px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    // Draw cells
    svg.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', d => xScale(String(d.jour)) || 0)
      .attr('y', d => yScale(d.lot_nom) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(Math.max(-20, Math.min(20, d.ecart_percent))))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke', '#000')
          .attr('stroke-width', 2);

        tooltip
          .style('visibility', 'visible')
          .html(`
            <strong>${d.lot_nom}</strong><br/>
            Jour: J${d.jour}<br/>
            Écart: ${d.ecart_percent.toFixed(1)}%<br/>
            ${d.ecart_percent > 0 ? '↗ Supérieur' : '↘ Inférieur'} au théorique
          `);
      })
      .on('mousemove', function(event) {
        tooltip
          .style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);

        tooltip.style('visibility', 'hidden');
      });

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('text-anchor', 'middle')
      .style('font-size', '11px');

    // X Axis Label
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + 45)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Jour de gavage');

    // Y Axis
    svg.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '11px');

    // Y Axis Label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -80)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Lots de gavage');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text('Performance Gaveur - Écart vs Théorique (%)');

    // Legend
    const legendWidth = 300;
    const legendHeight = 15;

    const legendScale = d3.scaleLinear()
      .domain([-20, 20])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d => `${d}%`);

    const legend = svg.append('g')
      .attr('transform', `translate(${width - legendWidth}, -30)`);

    // Legend gradient
    const defs = svg.append('defs');
    const linearGradient = defs.append('linearGradient')
      .attr('id', 'legend-gradient');

    linearGradient.selectAll('stop')
      .data([
        { offset: '0%', color: colorScale(-20) },
        { offset: '50%', color: colorScale(0) },
        { offset: '100%', color: colorScale(20) }
      ])
      .enter()
      .append('stop')
      .attr('offset', d => d.offset)
      .attr('stop-color', d => d.color);

    legend.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#legend-gradient)');

    legend.append('g')
      .attr('transform', `translate(0, ${legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .style('font-size', '10px');

    // Cleanup tooltip on unmount
    return () => {
      tooltip.remove();
    };
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement heatmap...</p>
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
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-8 ${className}`}>
        <div className="text-center">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-yellow-900 font-semibold text-lg mb-2">
            Aucune donnée disponible pour la heatmap
          </p>
          <p className="text-yellow-800 text-sm mb-4">
            {totalLots > 0 ? (
              <>
                Vous avez <strong>{totalLots} lots</strong> au total, mais seulement <strong>{lotsWithData} lot{lotsWithData !== 1 ? 's ont' : ' a'}</strong> des données de doses réelles/théoriques.
              </>
            ) : (
              "Aucun lot trouvé pour ce gaveur."
            )}
          </p>
          <div className="bg-white rounded-lg p-4 mt-4 text-left max-w-2xl mx-auto">
            <p className="text-sm text-gray-700 font-semibold mb-2">💡 Pour voir la heatmap :</p>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Créez une <strong>courbe théorique PySR</strong> pour vos lots (via page Courbes)</li>
              <li>Saisissez les <strong>doses réelles quotidiennes</strong> (page Gavage)</li>
              <li>Les écarts dose réelle vs théorique apparaîtront automatiquement ici</li>
            </ol>
          </div>
        </div>
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
          <strong>Légende:</strong> Rouge = Dose très inférieure au théorique |
          Jaune = Proche du théorique |
          Vert = Dose supérieure au théorique
        </p>
      </div>
    </div>
  );
}
