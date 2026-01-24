'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface GanttTask {
  lot_id: number;
  lot_nom: string;
  date_debut: Date;
  date_fin: Date;
  statut: string;
  alertes: number;
}

interface TimelineGanttLotsProps {
  gaveurId: number;
  filteredLotId?: number | null;
  className?: string;
}

export default function TimelineGanttLots({ gaveurId, filteredLotId = null, className = '' }: TimelineGanttLotsProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [gaveurId, filteredLotId]);

  useEffect(() => {
    if (data.length > 0 && svgRef.current) {
      renderGantt();
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

      const tasks: GanttTask[] = [];

      for (const lot of lotsToProcess) {
        const dateDebut = lot.date_debut ? new Date(lot.date_debut) : new Date();
        const dateFin = lot.date_fin_prevue
          ? new Date(lot.date_fin_prevue)
          : new Date(dateDebut.getTime() + 14 * 24 * 60 * 60 * 1000); // +14 jours par défaut

        // Charger les alertes pour ce lot
        let alertesCount = 0;
        try {
          const alertesResponse = await fetch(`${apiUrl}/api/alertes/lot/${lot.id}`);
          const alertesData = await alertesResponse.json();
          if (Array.isArray(alertesData)) {
            alertesCount = alertesData.filter((a: any) => a.statut === 'active').length;
          }
        } catch (err) {
          console.error(`Erreur chargement alertes lot ${lot.id}:`, err);
        }

        tasks.push({
          lot_id: lot.id,
          lot_nom: lot.nom || `Lot ${lot.id}`,
          date_debut: dateDebut,
          date_fin: dateFin,
          statut: lot.statut || 'en_gavage',
          alertes: alertesCount,
        });
      }

      // Trier par date de début
      tasks.sort((a, b) => a.date_debut.getTime() - b.date_debut.getTime());

      setData(tasks);
    } catch (err) {
      console.error('Erreur chargement données Gantt:', err);
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  const renderGantt = () => {
    if (!svgRef.current || data.length === 0) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    // Dimensions
    const margin = { top: 80, right: 100, bottom: 60, left: 150 };
    const width = 1000 - margin.left - margin.right;
    const height = Math.max(400, data.length * 50) - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const minDate = d3.min(data, d => d.date_debut) || new Date();
    const maxDate = d3.max(data, d => d.date_fin) || new Date();

    const xScale = d3.scaleTime()
      .domain([minDate, maxDate])
      .range([0, width]);

    const yScale = d3.scaleBand()
      .domain(data.map(d => d.lot_nom))
      .range([0, height])
      .padding(0.2);

    // Color scale by status
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['en_preparation', 'en_gavage', 'termine', 'annule'])
      .range(['#94a3b8', '#10b981', '#3b82f6', '#ef4444']);

    // Create tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'gantt-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '5px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    // Draw grid lines (vertical - dates)
    const xAxisGrid = d3.axisBottom(xScale)
      .ticks(d3.timeDay.every(2))
      .tickSize(height)
      .tickFormat(() => '');

    svg.append('g')
      .attr('class', 'grid')
      .call(xAxisGrid)
      .selectAll('line')
      .style('stroke', '#e5e7eb')
      .style('stroke-dasharray', '2,2');

    // Draw bars (Gantt tasks)
    svg.selectAll('rect.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.date_debut))
      .attr('y', d => yScale(d.lot_nom) || 0)
      .attr('width', d => Math.max(2, xScale(d.date_fin) - xScale(d.date_debut)))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(d.statut))
      .attr('stroke', '#000')
      .attr('stroke-width', 1)
      .attr('rx', 4)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.8);

        const dureeJours = Math.ceil((d.date_fin.getTime() - d.date_debut.getTime()) / (1000 * 60 * 60 * 24));

        tooltip
          .style('visibility', 'visible')
          .html(`
            <strong>${d.lot_nom}</strong><br/>
            Statut: ${d.statut}<br/>
            Début: ${d.date_debut.toLocaleDateString('fr-FR')}<br/>
            Fin: ${d.date_fin.toLocaleDateString('fr-FR')}<br/>
            Durée: ${dureeJours} jours<br/>
            Alertes: ${d.alertes}
          `);
      })
      .on('mousemove', function(event) {
        tooltip
          .style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 1);
        tooltip.style('visibility', 'hidden');
      });

    // Draw alert icons
    data.forEach(d => {
      if (d.alertes > 0) {
        svg.append('text')
          .attr('x', xScale(d.date_fin) + 5)
          .attr('y', (yScale(d.lot_nom) || 0) + yScale.bandwidth() / 2)
          .attr('dy', '0.35em')
          .text('⚠️')
          .style('font-size', '16px')
          .style('cursor', 'pointer')
          .on('mouseover', function(event) {
            tooltip
              .style('visibility', 'visible')
              .html(`<strong>${d.alertes} alerte(s)</strong> sur ${d.lot_nom}`);
          })
          .on('mousemove', function(event) {
            tooltip
              .style('top', (event.pageY - 10) + 'px')
              .style('left', (event.pageX + 10) + 'px');
          })
          .on('mouseout', function() {
            tooltip.style('visibility', 'hidden');
          });
      }
    });

    // X Axis
    const xAxis = d3.axisBottom(xScale)
      .ticks(d3.timeDay.every(2))
      .tickFormat(d => d3.timeFormat('%d/%m')(d as Date));

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-0.8em')
      .attr('dy', '0.15em')
      .attr('transform', 'rotate(-45)')
      .style('font-size', '10px');

    // X Axis Label
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + 55)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Dates');

    // Y Axis
    svg.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '11px');

    // Y Axis Label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -100)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Lots');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text('Timeline Gantt - Planning des Lots');

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - 180}, -40)`);

    const legendData = [
      { statut: 'en_preparation', label: 'Préparation' },
      { statut: 'en_gavage', label: 'En gavage' },
      { statut: 'termine', label: 'Terminé' },
      { statut: 'annule', label: 'Annulé' }
    ];

    legendData.forEach((item, i) => {
      legend.append('rect')
        .attr('x', 0)
        .attr('y', i * 20)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', colorScale(item.statut));

      legend.append('text')
        .attr('x', 20)
        .attr('y', i * 20 + 12)
        .text(item.label)
        .style('font-size', '11px');
    });

    // Today line
    const today = new Date();
    if (today >= minDate && today <= maxDate) {
      svg.append('line')
        .attr('x1', xScale(today))
        .attr('x2', xScale(today))
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

      svg.append('text')
        .attr('x', xScale(today))
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .text("Aujourd'hui")
        .style('font-size', '11px')
        .style('fill', '#ef4444')
        .style('font-weight', 'bold');
    }

    // Cleanup
    return () => {
      tooltip.remove();
    };
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement timeline Gantt...</p>
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
        <p className="text-yellow-800">Aucune donnée disponible pour la timeline Gantt</p>
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
          <strong>Légende:</strong> La ligne rouge verticale indique aujourd'hui.
          Les icônes ⚠️ indiquent des alertes actives.
        </p>
      </div>
    </div>
  );
}
