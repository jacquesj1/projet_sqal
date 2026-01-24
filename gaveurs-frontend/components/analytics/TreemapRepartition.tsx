'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface TreeNode {
  name: string;
  children?: TreeNode[];
  value?: number;
  category?: string;
  statut?: string;
}

interface TreemapRepartitionProps {
  gaveurId: number;
  filteredLotId?: number | null;
  className?: string;
}

export default function TreemapRepartition({ gaveurId, filteredLotId = null, className = '' }: TreemapRepartitionProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [gaveurId, filteredLotId]);

  useEffect(() => {
    if (data && svgRef.current) {
      renderTreemap();
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

      // Construire la hiérarchie: Gaveur → Statut → Race → Lots
      const statutGroups = new Map<string, Map<string, any[]>>();

      for (const lot of lotsToProcess) {
        const statut = lot.statut || 'inconnu';
        const race = lot.race || 'Race inconnue';

        if (!statutGroups.has(statut)) {
          statutGroups.set(statut, new Map());
        }

        const raceGroups = statutGroups.get(statut)!;
        if (!raceGroups.has(race)) {
          raceGroups.set(race, []);
        }

        raceGroups.get(race)!.push(lot);
      }

      // Construire l'arbre
      const rootNode: TreeNode = {
        name: `Gaveur ${gaveurId}`,
        children: []
      };

      statutGroups.forEach((raceGroups, statut) => {
        const statutNode: TreeNode = {
          name: getStatutLabel(statut),
          category: 'statut',
          children: []
        };

        raceGroups.forEach((lots, race) => {
          const raceNode: TreeNode = {
            name: race,
            category: 'race',
            children: lots.map((lot: any) => ({
              name: lot.code_lot || lot.nom || `Lot ${lot.id}`,
              value: lot.nombre_canards || 50,
              category: 'lot',
              statut: statut  // Ajouter le statut du parent
            }))
          };

          statutNode.children!.push(raceNode);
        });

        rootNode.children!.push(statutNode);
      });

      setData(rootNode);
    } catch (err) {
      console.error('Erreur chargement données treemap:', err);
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  const getStatutLabel = (statut: string): string => {
    const labels: { [key: string]: string } = {
      en_preparation: 'Préparation',
      en_gavage: 'En gavage',
      termine: 'Terminé',
      annule: 'Annulé',
      inconnu: 'Statut inconnu'
    };
    return labels[statut] || statut;
  };

  const renderTreemap = () => {
    if (!svgRef.current || !data) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    // Dimensions
    const width = 1000;
    const height = 600;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Color scale by statut
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['en_preparation', 'en_gavage', 'termine', 'abattu', 'inconnu'])
      .range(['#f97316', '#10b981', '#3b82f6', '#6b7280', '#94a3b8']);

    // Color intensity based on depth
    const opacityScale = d3.scaleLinear()
      .domain([0, 3])
      .range([0.3, 1]);

    // Create hierarchy
    const root = d3.hierarchy(data)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout
    const treemapLayout = d3.treemap<TreeNode>()
      .size([width, height])
      .padding(2)
      .round(true);

    treemapLayout(root);

    // Create tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'treemap-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '5px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    // Draw rectangles
    const cell = svg.selectAll('g')
      .data(root.leaves())
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    cell.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => {
        // Utiliser le statut pour la couleur
        const statut = d.data.statut || 'inconnu';
        return colorScale(statut);
      })
      .attr('opacity', d => opacityScale(d.depth))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke', '#000')
          .attr('stroke-width', 3);

        const path = d.ancestors().reverse().map(a => a.data.name).join(' → ');

        tooltip
          .style('visibility', 'visible')
          .html(`
            <strong>${d.data.name}</strong><br/>
            Chemin: ${path}<br/>
            Nombre de canards: ${d.value}<br/>
            Niveau: ${d.depth}
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
          .attr('stroke-width', 2);

        tooltip.style('visibility', 'hidden');
      });

    // Add text labels (only if space is sufficient)
    cell.append('text')
      .attr('x', 4)
      .attr('y', 16)
      .text(d => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        if (width > 60 && height > 30) {
          return d.data.name.length > 12 ? d.data.name.substring(0, 12) + '...' : d.data.name;
        }
        return '';
      })
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('fill', '#fff')
      .style('pointer-events', 'none');

    // Add value labels (only for larger cells)
    cell.append('text')
      .attr('x', 4)
      .attr('y', 32)
      .text(d => {
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        if (width > 60 && height > 45) {
          return `${d.value} canards`;
        }
        return '';
      })
      .style('font-size', '10px')
      .style('fill', '#fff')
      .style('opacity', 0.9)
      .style('pointer-events', 'none');

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .style('fill', '#000')
      .text('Répartition Hiérarchique - Statut → Race → Lots');

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - 150}, 50)`);

    const legendData = [
      { category: 'statut', label: 'Statut' },
      { category: 'race', label: 'Race' },
      { category: 'lot', label: 'Lot' }
    ];

    legendData.forEach((item, i) => {
      legend.append('rect')
        .attr('x', 0)
        .attr('y', i * 25)
        .attr('width', 20)
        .attr('height', 20)
        .attr('fill', colorScale(item.category))
        .attr('opacity', 0.7);

      legend.append('text')
        .attr('x', 25)
        .attr('y', i * 25 + 15)
        .text(item.label)
        .style('font-size', '12px');
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement treemap...</p>
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

  if (!data || !data.children || data.children.length === 0) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-6 ${className}`}>
        <p className="text-yellow-800">Aucune donnée disponible pour la treemap</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <svg ref={svgRef}></svg>
      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Légende:</strong> La taille des rectangles représente le nombre de canards.
          La hiérarchie montre: Statut → Race → Lots individuels.
        </p>
      </div>
    </div>
  );
}
