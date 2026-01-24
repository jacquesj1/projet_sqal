'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { courbesAPI } from '@/lib/courbes-api';

interface Node {
  id: string;
  label: string;
  category: string;
  value: number;
}

interface Link {
  source: string;
  target: string;
  correlation: number;
}

interface NetworkData {
  nodes: Node[];
  links: Link[];
}

interface NetworkGraphCorrelationsProps {
  gaveurId: number;
  filteredLotId?: number | null;
  className?: string;
}

export default function NetworkGraphCorrelations({ gaveurId, filteredLotId = null, className = '' }: NetworkGraphCorrelationsProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [gaveurId, filteredLotId]);

  useEffect(() => {
    if (data && svgRef.current) {
      renderNetwork();
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

      // Collecter les données pour calculer les corrélations
      const variables: { [key: string]: number[] } = {
        age_debut: [],
        poids_debut: [],
        poids_final: [],
        gain_poids: [],
        poids_foie: [],
        dose_moyenne: [],
        dose_totale: [],
        dose_min: [],
        dose_max: [],
        ecart_moyen: [],
        nombre_canards: [],
        duree_gavage: [],
        itm: [],
        // Variables qualité SQAL (optionnelles)
        grade_qualite: [],
        indice_fraicheur: [],
        indice_oxydation: [],
        // Variables CSV réelles (depuis import)
        poids_foie_reel: [],     // Poids_de_foies_moyen
        total_corn: [],          // total_cornReal
        nb_morts: [],            // Nb_MEG
        sigma: [],               // Sigma (écart-type/homogénéité)
      };

      for (const lot of lotsToProcess) {
        // Charger les données de gavage pour chaque lot
        try {
          const gavageData = await courbesAPI.getDosesReelles(lot.id);

          if (Array.isArray(gavageData) && gavageData.length > 0) {
            // Doses
            const doses = gavageData.map((d: any) => d.dose_reelle_g || 0);
            const doseMoyenne = doses.reduce((sum: number, d: number) => sum + d, 0) / doses.length;
            const doseTotale = doses.reduce((sum: number, d: number) => sum + d, 0);
            const doseMin = Math.min(...doses.filter(d => d > 0));
            const doseMax = Math.max(...doses);

            // Écarts
            const ecarts = gavageData
              .filter((d: any) => d.dose_theorique_g && d.dose_reelle_g)
              .map((d: any) => Math.abs(d.dose_reelle_g - d.dose_theorique_g) / d.dose_theorique_g * 100);
            const ecartMoyen = ecarts.length > 0 ? ecarts.reduce((a: number, b: number) => a + b, 0) / ecarts.length : 0;

            // Poids (début, final, gain)
            const poidsDebut = lot.poids_moyen_initial || lot.poids_moyen_debut || 4000;
            const poidsFinal = lot.poids_moyen_actuel || lot.poids_moyen_final || poidsDebut + (doseMoyenne * gavageData.length * 0.15);
            const gainPoids = poidsFinal - poidsDebut;

            // ITM (Indice de Transformation Maïs) depuis CSV ou moyenne
            // ITM = dose_totale (kg) / poids_foie (kg)
            // Plus l'ITM est bas, meilleure est la conversion (moins de maïs pour 1kg de foie)
            const itm = lot.itm || 16.5; // Valeur moyenne si manquante

            // Poids de foie calculé depuis ITM (formule inverse)
            // poids_foie (g) = dose_totale (g) / ITM
            // Si poids_foie réel disponible, on l'utilise
            const poidsFoie = lot.poids_foie_moyen || (doseTotale > 0 ? doseTotale / itm : 500);

            variables.age_debut.push(lot.age_debut_gavage || 80);
            variables.poids_debut.push(poidsDebut);
            variables.poids_final.push(poidsFinal);
            variables.gain_poids.push(gainPoids);
            variables.poids_foie.push(poidsFoie);
            variables.dose_moyenne.push(doseMoyenne);
            variables.dose_totale.push(doseTotale);
            variables.dose_min.push(doseMin);
            variables.dose_max.push(doseMax);
            variables.ecart_moyen.push(ecartMoyen);
            variables.nombre_canards.push(lot.nombre_canards || 50);
            variables.duree_gavage.push(gavageData.length);
            variables.itm.push(itm);

            // Variables CSV réelles (depuis import CSV)
            variables.poids_foie_reel.push(lot.poids_foie_moyen_g || poidsFoie); // Poids foie réel CSV ou calculé
            variables.total_corn.push(lot.total_corn_real_g || doseTotale);       // Dose totale CSV ou calculée
            variables.nb_morts.push(lot.nb_meg || 0);                             // Mortalité en gavage
            variables.sigma.push(lot.sigma || 0.15);                              // Écart-type (homogénéité)

            // Charger données qualité SQAL si disponibles
            try {
              const qualiteResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/lots/${lot.id}/qualite`);
              if (qualiteResponse.ok) {
                const qualiteData = await qualiteResponse.json();

                if (qualiteData.has_sqal_data) {
                  // Convertir grade en valeur numérique pour corrélation
                  const gradeValues: { [key: string]: number } = {
                    'A+': 5,
                    'A': 4,
                    'B': 3,
                    'C': 2,
                    'REJECT': 1
                  };
                  const gradeNum = gradeValues[qualiteData.grades?.majoritaire || 'B'] || 3;

                  variables.grade_qualite.push(gradeNum);
                  variables.indice_fraicheur.push(qualiteData.indices_spectraux?.fraicheur || 0.85);
                  variables.indice_oxydation.push(qualiteData.indices_spectraux?.oxydation || 0.10);
                } else {
                  // Pas de données SQAL → valeurs par défaut (neutres)
                  variables.grade_qualite.push(3.5); // Entre B et A
                  variables.indice_fraicheur.push(0.85);
                  variables.indice_oxydation.push(0.10);
                }
              } else {
                // Endpoint non disponible → valeurs par défaut
                variables.grade_qualite.push(3.5);
                variables.indice_fraicheur.push(0.85);
                variables.indice_oxydation.push(0.10);
              }
            } catch (qualiteErr) {
              // Erreur chargement qualité → valeurs par défaut
              variables.grade_qualite.push(3.5);
              variables.indice_fraicheur.push(0.85);
              variables.indice_oxydation.push(0.10);
            }
          }
        } catch (err) {
          console.error(`Erreur chargement gavage lot ${lot.id}:`, err);
        }
      }

      // Calculer les corrélations de Pearson entre toutes les paires de variables
      const correlations: Link[] = [];
      const varNames = Object.keys(variables);

      for (let i = 0; i < varNames.length; i++) {
        for (let j = i + 1; j < varNames.length; j++) {
          const var1 = variables[varNames[i]];
          const var2 = variables[varNames[j]];

          if (var1.length > 0 && var2.length > 0 && var1.length === var2.length) {
            const corr = pearsonCorrelation(var1, var2);
            if (Math.abs(corr) > 0.3) { // Seuil: corrélation > 0.3
              correlations.push({
                source: varNames[i],
                target: varNames[j],
                correlation: corr,
              });
            }
          }
        }
      }

      // Créer les noeuds
      const nodes: Node[] = varNames.map(varName => ({
        id: varName,
        label: getVariableLabel(varName),
        category: getVariableCategory(varName),
        value: variables[varName].length,
      }));

      setData({ nodes, links: correlations });
    } catch (err) {
      console.error('Erreur chargement données network:', err);
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  const pearsonCorrelation = (x: number[], y: number[]): number => {
    const n = x.length;
    if (n === 0) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      sumSqX += dx * dx;
      sumSqY += dy * dy;
    }

    const denominator = Math.sqrt(sumSqX * sumSqY);
    return denominator === 0 ? 0 : numerator / denominator;
  };

  const getVariableLabel = (varName: string): string => {
    const labels: { [key: string]: string } = {
      age_debut: 'Âge début',
      poids_debut: 'Poids début',
      poids_final: 'Poids final',
      gain_poids: 'Gain poids',
      poids_foie: 'Poids foie',
      dose_moyenne: 'Dose moyenne',
      dose_totale: 'Dose totale',
      dose_min: 'Dose min',
      dose_max: 'Dose max',
      ecart_moyen: 'Écart moyen',
      nombre_canards: 'Nb canards',
      duree_gavage: 'Durée gavage',
      itm: 'ITM',
      grade_qualite: 'Grade qualité',
      indice_fraicheur: 'Fraîcheur',
      indice_oxydation: 'Oxydation',
      // Variables CSV réelles (depuis import Euralis)
      poids_foie_reel: 'Poids foie réel',
      total_corn: 'Dose totale maïs',
      nb_morts: 'Mortalité gavage',
      sigma: 'Homogénéité lot',
    };
    return labels[varName] || varName;
  };

  const getVariableCategory = (varName: string): string => {
    if (['age_debut', 'poids_debut', 'poids_final', 'gain_poids', 'poids_foie'].includes(varName)) return 'canard';
    if (['dose_moyenne', 'dose_totale', 'dose_min', 'dose_max', 'ecart_moyen', 'duree_gavage'].includes(varName)) return 'gavage';
    if (['itm', 'sigma'].includes(varName)) return 'performance';
    if (['grade_qualite', 'indice_fraicheur', 'indice_oxydation'].includes(varName)) return 'qualite';
    if (['poids_foie_reel', 'total_corn', 'nb_morts'].includes(varName)) return 'csv';
    return 'lot';
  };

  const renderNetwork = () => {
    if (!svgRef.current || !data) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    // Dimensions - Augmentées pour voir tous les nœuds
    const width = 1200;
    const height = 800;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Color scale by category (6 catégories: canard, gavage, performance, qualite, csv, lot)
    const colorScale = d3.scaleOrdinal<string>()
      .domain(['canard', 'gavage', 'performance', 'qualite', 'csv', 'lot'])
      .range(['#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#f59e0b']);

    // Create tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'network-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '5px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    // Force simulation avec répulsion plus forte pour 20 nœuds
    const simulation = d3.forceSimulation(data.nodes as any)
      .force('link', d3.forceLink(data.links)
        .id((d: any) => d.id)
        .distance(d => 200 * (1 - Math.abs((d as any).correlation))))
      .force('charge', d3.forceManyBody().strength(-1400))  // Plus de répulsion pour 20 nœuds
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(85))  // Espace pour nœuds + labels
      .force('x', d3.forceX(width / 2).strength(0.05))  // Centrer horizontalement
      .force('y', d3.forceY(height / 2).strength(0.05)); // Centrer verticalement

    // Draw links
    const link = svg.append('g')
      .selectAll('line')
      .data(data.links)
      .enter()
      .append('line')
      .attr('stroke', d => d.correlation > 0 ? '#10b981' : '#ef4444')
      .attr('stroke-width', d => Math.abs(d.correlation) * 5)
      .attr('opacity', 0.6)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 1);

        tooltip
          .style('visibility', 'visible')
          .html(`
            <strong>${getVariableLabel(d.source as string)} ↔ ${getVariableLabel(d.target as string)}</strong><br/>
            Corrélation: ${d.correlation.toFixed(3)}<br/>
            ${d.correlation > 0 ? 'Positive (↗)' : 'Négative (↘)'}
          `);
      })
      .on('mousemove', function(event) {
        tooltip
          .style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.6);
        tooltip.style('visibility', 'hidden');
      });

    // Draw nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(data.nodes)
      .enter()
      .append('g')
      .style('cursor', 'grab')
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    node.append('circle')
      .attr('r', 30)  // Nœuds plus grands
      .attr('fill', d => colorScale(d.category))
      .attr('stroke', '#fff')
      .attr('stroke-width', 3)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r', 35);

        // Message spécial pour poids foie (estimation)
        let tooltipContent = `
          <strong>${d.label}</strong><br/>
          Catégorie: ${d.category}<br/>
          Observations: ${d.value}
        `;

        if (d.id === 'poids_foie') {
          tooltipContent += `<br/><em style="color: #f59e0b;">⚠️ Valeur estimée depuis ITM</em><br/><small>Poids réel non disponible</small>`;
        }

        tooltip
          .style('visibility', 'visible')
          .html(tooltipContent);
      })
      .on('mousemove', function(event) {
        tooltip
          .style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('r', 30);
        tooltip.style('visibility', 'hidden');
      });

    // Label complet en dessous du nœud
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '45')  // Positionner en dessous du cercle
      .text(d => d.label)  // Label complet
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 0 3px white, 0 0 3px white');  // Contour blanc pour lisibilité

    // Title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text('Réseau de Corrélations - Variables de Production');

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(20, ${height - 100})`);

    const legendData = [
      { category: 'canard', label: 'Variables canard' },
      { category: 'gavage', label: 'Variables gavage' },
      { category: 'lot', label: 'Variables lot' }
    ];

    legendData.forEach((item, i) => {
      legend.append('circle')
        .attr('cx', 0)
        .attr('cy', i * 25)
        .attr('r', 8)
        .attr('fill', colorScale(item.category));

      legend.append('text')
        .attr('x', 15)
        .attr('y', i * 25 + 5)
        .text(item.label)
        .style('font-size', '12px');
    });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      d3.select(this).style('cursor', 'grabbing');
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
      d3.select(this).style('cursor', 'grab');
    }

    // Cleanup
    return () => {
      simulation.stop();
      tooltip.remove();
    };
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Calcul des corrélations...</p>
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
        <p className="text-yellow-800">Aucune donnée disponible pour le réseau de corrélations</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <svg ref={svgRef}></svg>
      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Légende:</strong> Lignes vertes = corrélation positive |
          Lignes rouges = corrélation négative |
          Épaisseur = force de la corrélation |
          Cliquez-glissez pour déplacer les noeuds
        </p>
      </div>
    </div>
  );
}
