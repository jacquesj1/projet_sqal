'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import type { Lot, QualiteSQAL } from '@/types/lot';

interface LotWithQualite extends Lot {
  qualite_sqal?: QualiteSQAL;
}

interface QualiteStats {
  totalLots: number;
  lotsAvecQualite: number;
  gradeMajoritaire: string;
  poidsFoieMoyen: number;
  itmMoyen: number;
  fraicheurMoyenne: number;
  oxydationMoyenne: number;
}

export default function QualitePage() {
  const [lots, setLots] = useState<LotWithQualite[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QualiteStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // Charger tous les lots
      const lotsResponse = await fetch(`${apiUrl}/api/lots`);
      const lotsData: Lot[] = await lotsResponse.json();

      // Charger les données qualité pour chaque lot
      const lotsWithQualite = await Promise.all(
        lotsData.map(async (lot) => {
          try {
            const qualiteResponse = await fetch(`${apiUrl}/api/lots/${lot.id}/qualite`);
            if (qualiteResponse.ok) {
              const qualiteData = await qualiteResponse.json();
              return { ...lot, qualite_sqal: qualiteData };
            }
          } catch (err) {
            console.error(`Erreur qualité lot ${lot.id}:`, err);
          }
          return lot;
        })
      );

      setLots(lotsWithQualite);
      calculateStats(lotsWithQualite);
    } catch (err) {
      console.error('Erreur chargement données:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (lotsData: LotWithQualite[]) => {
    const lotsAvecQualite = lotsData.filter(
      (lot) => lot.qualite_sqal?.has_sqal_data
    );

    if (lotsAvecQualite.length === 0) {
      setStats({
        totalLots: lotsData.length,
        lotsAvecQualite: 0,
        gradeMajoritaire: 'N/A',
        poidsFoieMoyen: 0,
        itmMoyen: 0,
        fraicheurMoyenne: 0,
        oxydationMoyenne: 0,
      });
      return;
    }

    const gradeCount: { [key: string]: number } = {};
    let totalPoidsFoie = 0;
    let totalItm = 0;
    let totalFraicheur = 0;
    let totalOxydation = 0;
    let countItm = 0;

    lotsAvecQualite.forEach((lot) => {
      const grade = lot.qualite_sqal?.grades?.majoritaire;
      if (grade) {
        gradeCount[grade] = (gradeCount[grade] || 0) + 1;
      }
      if (lot.qualite_sqal?.poids_foie?.moyen_g) {
        totalPoidsFoie += lot.qualite_sqal.poids_foie.moyen_g;
      }
      if (lot.itm) {
        totalItm += lot.itm;
        countItm++;
      }
      if (lot.qualite_sqal?.indices_spectraux?.fraicheur) {
        totalFraicheur += lot.qualite_sqal.indices_spectraux.fraicheur;
      }
      if (lot.qualite_sqal?.indices_spectraux?.oxydation) {
        totalOxydation += lot.qualite_sqal.indices_spectraux.oxydation;
      }
    });

    const gradeMajoritaire =
      Object.entries(gradeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    setStats({
      totalLots: lotsData.length,
      lotsAvecQualite: lotsAvecQualite.length,
      gradeMajoritaire,
      poidsFoieMoyen: totalPoidsFoie / lotsAvecQualite.length,
      itmMoyen: countItm > 0 ? totalItm / countItm : 0,
      fraicheurMoyenne: totalFraicheur / lotsAvecQualite.length,
      oxydationMoyenne: totalOxydation / lotsAvecQualite.length,
    });
  };

  // Données pour le scatter plot ITM vs Grade
  const getScatterData = () => {
    const gradeValues: { [key: string]: number } = {
      'A+': 5,
      A: 4,
      B: 3,
      C: 2,
      REJECT: 1,
    };

    return lots
      .filter((lot) => lot.qualite_sqal?.has_sqal_data && lot.itm)
      .map((lot) => ({
        itm: lot.itm || 0,
        grade:
          gradeValues[lot.qualite_sqal?.grades?.majoritaire || 'B'] || 3,
        gradeName: lot.qualite_sqal?.grades?.majoritaire || 'N/A',
        lotName: lot.code_lot,
        poidsFoie: lot.qualite_sqal?.poids_foie?.moyen_g || 0,
        fraicheur: lot.qualite_sqal?.indices_spectraux?.fraicheur || 0,
      }));
  };

  // Distribution des grades
  const getGradeDistribution = () => {
    const gradeCount: { [key: string]: number } = {};
    lots
      .filter((lot) => lot.qualite_sqal?.has_sqal_data)
      .forEach((lot) => {
        const grade = lot.qualite_sqal?.grades?.majoritaire;
        if (grade) {
          gradeCount[grade] = (gradeCount[grade] || 0) + 1;
        }
      });

    return Object.entries(gradeCount).map(([grade, count]) => ({
      grade,
      count,
    }));
  };

  // Évolution fraîcheur et oxydation par lot
  const getQualityIndicesData = () => {
    return lots
      .filter((lot) => lot.qualite_sqal?.has_sqal_data)
      .map((lot) => ({
        lotName: lot.code_lot,
        fraicheur: lot.qualite_sqal?.indices_spectraux?.fraicheur
          ? lot.qualite_sqal.indices_spectraux.fraicheur * 100
          : 0,
        oxydation: lot.qualite_sqal?.indices_spectraux?.oxydation
          ? lot.qualite_sqal.indices_spectraux.oxydation * 100
          : 0,
        qualiteGras: lot.qualite_sqal?.indices_spectraux?.qualite_gras
          ? lot.qualite_sqal.indices_spectraux.qualite_gras * 100
          : 0,
      }));
  };

  // Radar chart - Profile qualité moyen par grade
  const getRadarDataByGrade = () => {
    const grades = ['A+', 'A', 'B', 'C'];
    return grades.map((grade) => {
      const lotsGrade = lots.filter(
        (lot) => lot.qualite_sqal?.grades?.majoritaire === grade
      );

      if (lotsGrade.length === 0) {
        return {
          grade,
          fraicheur: 0,
          qualiteGras: 0,
          score: 0,
          conformite: 0,
        };
      }

      const avgFraicheur =
        lotsGrade.reduce(
          (sum, lot) =>
            sum + (lot.qualite_sqal?.indices_spectraux?.fraicheur || 0),
          0
        ) / lotsGrade.length;
      const avgQualiteGras =
        lotsGrade.reduce(
          (sum, lot) =>
            sum + (lot.qualite_sqal?.indices_spectraux?.qualite_gras || 0),
          0
        ) / lotsGrade.length;
      const avgScore =
        lotsGrade.reduce(
          (sum, lot) => sum + (lot.qualite_sqal?.scores?.moyen || 0),
          0
        ) / lotsGrade.length;
      const avgConformite =
        lotsGrade.reduce(
          (sum, lot) =>
            sum + (lot.qualite_sqal?.conformite?.pourcent_conformes || 0) / 100,
          0
        ) / lotsGrade.length;

      return {
        grade,
        fraicheur: avgFraicheur * 100,
        qualiteGras: avgQualiteGras * 100,
        score: avgScore * 100,
        conformite: avgConformite * 100,
      };
    });
  };

  const gradeColors: { [key: string]: string } = {
    'A+': '#10b981',
    A: '#3b82f6',
    B: '#eab308',
    C: '#f97316',
    REJECT: '#ef4444',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
          </div>
        </div>
      </div>
    );
  }

  const scatterData = getScatterData();
  const gradeDistribution = getGradeDistribution();
  const qualityIndices = getQualityIndicesData();
  const radarData = getRadarDataByGrade();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/analytics"
            className="text-pink-600 hover:underline flex items-center mb-4"
          >
            <svg
              className="w-5 h-5 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Retour aux analytics
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">
            Analytics Qualité SQAL
          </h1>
          <p className="text-gray-600 mt-2">
            Corrélations entre paramètres de production et qualité des foies
          </p>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
              <p className="text-sm opacity-90">Lots avec données SQAL</p>
              <p className="text-4xl font-bold mt-2">
                {stats.lotsAvecQualite} / {stats.totalLots}
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <p className="text-sm opacity-90">Grade majoritaire</p>
              <p className="text-4xl font-bold mt-2">{stats.gradeMajoritaire}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <p className="text-sm opacity-90">Poids foie moyen</p>
              <p className="text-4xl font-bold mt-2">
                {stats.poidsFoieMoyen.toFixed(0)} g
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
              <p className="text-sm opacity-90">ITM moyen</p>
              <p className="text-4xl font-bold mt-2">
                {stats.itmMoyen.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Graphiques */}
        <div className="space-y-6">
          {/* Scatter plot ITM vs Grade */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Corrélation ITM vs Grade Qualité
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Plus l'ITM est bas, meilleure est la conversion du maïs en foie
              gras. Un bon ITM corrélé avec un grade élevé indique une
              production optimale.
            </p>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="itm"
                  name="ITM"
                  label={{
                    value: 'ITM (Indice Transformation Maïs)',
                    position: 'insideBottom',
                    offset: -10,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="grade"
                  name="Grade"
                  domain={[0, 6]}
                  ticks={[1, 2, 3, 4, 5]}
                  label={{
                    value: 'Grade Qualité',
                    angle: -90,
                    position: 'insideLeft',
                  }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded shadow-lg">
                          <p className="font-semibold">{data.lotName}</p>
                          <p className="text-sm">Grade: {data.gradeName}</p>
                          <p className="text-sm">ITM: {data.itm?.toFixed(2)}</p>
                          <p className="text-sm">
                            Poids foie: {data.poidsFoie?.toFixed(0)} g
                          </p>
                          <p className="text-sm">
                            Fraîcheur: {(data.fraicheur * 100).toFixed(1)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Scatter name="Lots" data={scatterData} fill="#ec4899" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Distribution des grades + Indices qualité */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribution grades */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Distribution des Grades
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={gradeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="Nombre de lots">
                    {gradeDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={gradeColors[entry.grade] || '#6b7280'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Indices qualité */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Indices Spectraux
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={qualityIndices}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="lotName" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="fraicheur"
                    stroke="#10b981"
                    name="Fraîcheur (%)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="oxydation"
                    stroke="#ef4444"
                    name="Oxydation (%)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="qualiteGras"
                    stroke="#eab308"
                    name="Qualité gras (%)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Radar chart - Profil qualité par grade */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Profil Qualité Moyen par Grade
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Comparaison des scores moyens (fraîcheur, qualité gras, score
              global, conformité) selon le grade final
            </p>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="grade" />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar
                  name="Fraîcheur"
                  dataKey="fraicheur"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                />
                <Radar
                  name="Qualité gras"
                  dataKey="qualiteGras"
                  stroke="#eab308"
                  fill="#eab308"
                  fillOpacity={0.3}
                />
                <Radar
                  name="Score global"
                  dataKey="score"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                />
                <Radar
                  name="Conformité"
                  dataKey="conformite"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.3}
                />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Message si pas de données */}
          {stats && stats.lotsAvecQualite === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <svg
                className="w-16 h-16 mx-auto text-yellow-500 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                Aucune donnée qualité disponible
              </h3>
              <p className="text-yellow-700 mb-4">
                Générez des données SQAL pour visualiser les analyses qualité
              </p>
              <div className="bg-white p-4 rounded border border-yellow-300 text-left">
                <p className="text-sm text-gray-700 font-mono mb-2">
                  # Générer des données test SQAL:
                </p>
                <code className="text-xs bg-gray-100 p-2 rounded block">
                  cd backend-api
                  <br />
                  scripts\generate_sqal_data.bat --nb-lots 10
                  --samples-per-lot 30
                </code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
