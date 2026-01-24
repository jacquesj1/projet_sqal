'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from 'd3-sankey';

interface SankeyData {
  nodes: { name: string; category: string }[];
  links: { source: number; target: number; value: number }[];
}

interface SankeyFluxProductionProps {
  gaveurId: number;
  filteredLotId?: number | null;
  className?: string;
}

export default function SankeyFluxProduction({ gaveurId, filteredLotId = null, className = '' }: SankeyFluxProductionProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<SankeyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [gaveurId, filteredLotId]);

  useEffect(() => {
    if (data && svgRef.current) {
      renderSankey();
    }
  }, [data]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // Charger les infos du gaveur
      let gaveurName = `Gaveur ${gaveurId}`;
      try {
        const gaveurResponse = await fetch(`${apiUrl}/api/gaveurs/${gaveurId}`);
        const gaveur = await gaveurResponse.json();
        if (gaveur.nom && gaveur.prenom) {
          gaveurName = `${gaveur.prenom} ${gaveur.nom}`;
        }
      } catch (err) {
        console.error('Erreur chargement gaveur:', err);
      }

      const response = await fetch(`${apiUrl}/api/lots/gaveur/${gaveurId}`);
      const lots = await response.json();

      // Filtrer par lot si spécifié
      const lotsToProcess = filteredLotId
        ? lots.filter((l: any) => l.id === filteredLotId)
        : lots;

      // Construire les noeuds et liens
      const nodes: { name: string; category: string }[] = [];
      const links: { source: number; target: number; value: number }[] = [];
      const nodeMap = new Map<string, number>();

      const addNode = (name: string, category: string) => {
        if (!nodeMap.has(name)) {
          nodeMap.set(name, nodes.length);
          nodes.push({ name, category });
        }
        return nodeMap.get(name)!;
      };

      // Noeuds: Lots, Gaveur, Sites, Qualités
      const gaveurNode = addNode(gaveurName, 'gaveur');

      // Agrégation par statut et race
      const statutCounts = new Map<string, number>();
      const raceCounts = new Map<string, number>();
      const qualiteCounts = new Map<string, number>();

      for (const lot of lotsToProcess) {
        const lotNode = addNode(lot.code_lot || `Lot ${lot.id}`, 'lot');
        const raceNode = addNode(lot.race || 'Race inconnue', 'race');
        const statutNode = addNode(lot.statut || 'Statut inconnu', 'statut');

        // Lots → Gaveur
        const existingLink = links.find(l => l.source === lotNode && l.target === gaveurNode);
        if (existingLink) {
          existingLink.value += lot.nombre_canards || 50;
        } else {
          links.push({
            source: lotNode,
            target: gaveurNode,
            value: lot.nombre_canards || 50
          });
        }

        // Gaveur → Race
        const existingRaceLink = links.find(l => l.source === gaveurNode && l.target === raceNode);
        if (existingRaceLink) {
          existingRaceLink.value += lot.nombre_canards || 50;
        } else {
          links.push({
            source: gaveurNode,
            target: raceNode,
            value: lot.nombre_canards || 50
          });
        }

        // Race → Statut
        const existingStatutLink = links.find(l => l.source === raceNode && l.target === statutNode);
        if (existingStatutLink) {
          existingStatutLink.value += lot.nombre_canards || 50;
        } else {
          links.push({
            source: raceNode,
            target: statutNode,
            value: lot.nombre_canards || 50
          });
        }

        // Statut → Qualité (simulée)
        const qualite = lot.statut === 'termine'
          ? (Math.random() > 0.7 ? 'Qualité A+' : Math.random() > 0.4 ? 'Qualité A' : 'Qualité B')
          : 'En cours';
        const qualiteNode = addNode(qualite, 'qualite');

        const existingQualiteLink = links.find(l => l.source === statutNode && l.target === qualiteNode);
        if (existingQualiteLink) {
          existingQualiteLink.value += lot.nombre_canards || 50;
        } else {
          links.push({
            source: statutNode,
            target: qualiteNode,
            value: lot.nombre_canards || 50
          });
        }
      }

      setData({ nodes, links });
    } catch (err) {
      console.error('Erreur chargement données Sankey:', err);
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  const renderSankey = () => {
    if (!svgRef.current || !data) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    // Dimensions
    const margin = { top: 60, right: 200, bottom: 40, left: 200 };
    const width = 1200 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Color scale by category
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['lot', 'gaveur', 'race', 'statut', 'qualite'])
      .range(['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']);

    // Create sankey generator
    const sankeyGenerator = sankey<{ name: string; category: string }, { source: number; target: number; value: number }>()
      .nodeWidth(20)
      .nodePadding(15)
      .extent([[0, 0], [width, height]]);

    // Generate sankey layout
    const { nodes, links } = sankeyGenerator({
      nodes: data.nodes.map(d => ({ ...d })),
      links: data.links.map(d => ({ ...d }))
    });

    // Create tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'sankey-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '5px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    // Draw links
    svg.append('g')
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', d => {
        const sourceNode = nodes[typeof d.source === 'number' ? d.source : (d.source as any).index];
        return colorScale(sourceNode.category);
      })
      .attr('stroke-width', d => Math.max(1, d.width || 0))
      .attr('fill', 'none')
      .attr('opacity', 0.4)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.7);

        const sourceNode = nodes[typeof d.source === 'number' ? d.source : (d.source as any).index];
        const targetNode = nodes[typeof d.target === 'number' ? d.target : (d.target as any).index];

        tooltip
          .style('visibility', 'visible')
          .html(`
            <strong>${sourceNode.name}</strong> → <strong>${targetNode.name}</strong><br/>
            Flux: ${d.value} canards
          `);
      })
      .on('mousemove', function(event) {
        tooltip
          .style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.4);
        tooltip.style('visibility', 'hidden');
      });

    // Draw nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g');

    node.append('rect')
      .attr('x', d => d.x0 || 0)
      .attr('y', d => d.y0 || 0)
      .attr('height', d => (d.y1 || 0) - (d.y0 || 0))
      .attr('width', d => (d.x1 || 0) - (d.x0 || 0))
      .attr('fill', d => colorScale(d.category))
      .attr('stroke', '#000')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.8);

        const totalIn = links
          .filter(l => {
            const target = typeof l.target === 'number' ? l.target : (l.target as any).index;
            return target === (d as any).index;
          })
          .reduce((sum, l) => sum + l.value, 0);

        const totalOut = links
          .filter(l => {
            const source = typeof l.source === 'number' ? l.source : (l.source as any).index;
            return source === (d as any).index;
          })
          .reduce((sum, l) => sum + l.value, 0);

        tooltip
          .style('visibility', 'visible')
          .html(`
            <strong>${d.name}</strong><br/>
            Entrées: ${totalIn} canards<br/>
            Sorties: ${totalOut} canards
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

    // Node labels
    node.append('text')
      .attr('x', d => ((d.x0 || 0) < width / 2) ? (d.x1 || 0) + 6 : (d.x0 || 0) - 6)
      .attr('y', d => ((d.y1 || 0) + (d.y0 || 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => ((d.x0 || 0) < width / 2) ? 'start' : 'end')
      .text(d => d.name)
      .style('font-size', '11px')
      .style('font-weight', '500');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', -30)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text('Flux de Production - Lots → Gaveur → Race → Statut → Qualité');

    // Cleanup
    return () => {
      tooltip.remove();
    };
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement diagramme Sankey...</p>
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

  if (!data || data.nodes.length === 0) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-6 ${className}`}>
        <p className="text-yellow-800">Aucune donnée disponible pour le diagramme Sankey</p>
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
          <strong>Légende:</strong> L'épaisseur des flux représente le nombre de canards.
          Survolez les noeuds et liens pour plus de détails.
        </p>
      </div>
    </div>
  );
}
