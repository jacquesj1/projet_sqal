'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { courbesAPI } from '@/lib/courbes-api';

interface LotEvent {
  lot_id: number;
  code_lot: string;
  statut: string;
  jour_gavage: number;
  date: string;
  nombre_canards: number;
  has_alerte: boolean;
}

interface CalendrierPlanningLotsProps {
  gaveurId: number;
  filteredLotId?: number | null;
  className?: string;
}

export default function CalendrierPlanningLots({ gaveurId, filteredLotId = null, className = '' }: CalendrierPlanningLotsProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Map<string, LotEvent[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<'month' | 'week'>('month');

  useEffect(() => {
    loadData();
  }, [gaveurId, filteredLotId, currentDate]);

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

      const eventsMap = new Map<string, LotEvent[]>();

      for (const lot of lotsToProcess) {
        try {
          // Charger les doses réelles pour connaître les jours de gavage
          const gavageData = await courbesAPI.getDosesReelles(lot.id);

          // Note: Endpoint alertes à implémenter côté backend
          // Pour l'instant, on considère qu'il n'y a pas d'alertes
          let hasAlerte = false;

          if (Array.isArray(gavageData)) {
            gavageData.forEach((entry: any) => {
              if (entry.date_gavage && entry.jour_gavage) {
                const dateKey = entry.date_gavage.split('T')[0]; // YYYY-MM-DD

                const event: LotEvent = {
                  lot_id: lot.id,
                  code_lot: lot.code_lot || lot.nom || `Lot ${lot.id}`,
                  statut: lot.statut,
                  jour_gavage: entry.jour_gavage,
                  date: dateKey,
                  nombre_canards: lot.nombre_canards || 50,
                  has_alerte: hasAlerte,
                };

                if (!eventsMap.has(dateKey)) {
                  eventsMap.set(dateKey, []);
                }
                eventsMap.get(dateKey)!.push(event);
              }
            });
          }
        } catch (err) {
          console.error(`Erreur chargement gavage lot ${lot.id}:`, err);
        }
      }

      setEvents(eventsMap);
    } catch (err) {
      console.error('Erreur chargement données calendrier:', err);
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = dimanche

    const days = [];

    // Jours du mois précédent pour compléter la première semaine
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const startOffset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1; // Lundi = 0

    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Jours du mois actuel
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Jours du mois suivant pour compléter la dernière semaine
    const remainingDays = 42 - days.length; // 6 semaines x 7 jours
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getStatutColor = (statut: string): string => {
    switch (statut) {
      case 'en_gavage':
        return 'bg-green-500';
      case 'termine':
        return 'bg-blue-500';
      case 'en_preparation':
        return 'bg-orange-500';
      case 'abattu':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatutLabel = (statut: string): string => {
    switch (statut) {
      case 'en_gavage':
        return 'En gavage';
      case 'termine':
        return 'Terminé';
      case 'en_preparation':
        return 'Préparation';
      case 'abattu':
        return 'Abattu';
      default:
        return statut;
    }
  };

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const days = getDaysInMonth(currentDate);
  const today = formatDateKey(new Date());
  const selectedEvents = selectedDate ? events.get(selectedDate) || [] : [];

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du calendrier...</p>
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

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-blue-600" />
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Aujourd'hui
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={previousMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Mois précédent"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Mois suivant"
          >
            <ChevronRight className="w-6 h-6 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {dayNames.map((day) => (
            <div key={day} className="p-3 text-center font-semibold text-gray-700 text-sm">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dateKey = formatDateKey(day.date);
            const dayEvents = events.get(dateKey) || [];
            const isToday = dateKey === today;
            const isSelected = dateKey === selectedDate;

            return (
              <div
                key={index}
                onClick={() => dayEvents.length > 0 && setSelectedDate(dateKey)}
                className={`min-h-[120px] p-2 border-r border-b border-gray-200 transition-all ${
                  !day.isCurrentMonth ? 'bg-gray-50' : 'bg-white hover:bg-blue-50'
                } ${dayEvents.length > 0 ? 'cursor-pointer' : ''} ${
                  isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-sm font-semibold ${
                      !day.isCurrentMonth
                        ? 'text-gray-400'
                        : isToday
                        ? 'bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center'
                        : 'text-gray-900'
                    }`}
                  >
                    {day.date.getDate()}
                  </span>
                  {dayEvents.some(e => e.has_alerte) && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event, idx) => (
                    <div
                      key={idx}
                      className={`text-xs px-2 py-1 rounded text-white font-semibold truncate ${getStatutColor(
                        event.statut
                      )}`}
                      title={`${event.code_lot} - J${event.jour_gavage}`}
                    >
                      {event.code_lot} J{event.jour_gavage}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500 font-semibold text-center">
                      +{dayEvents.length - 3} autre{dayEvents.length - 3 > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Légende */}
      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-gray-700">En gavage</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-gray-700">Terminé</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-500 rounded"></div>
          <span className="text-gray-700">Préparation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-500 rounded"></div>
          <span className="text-gray-700">Abattu</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-gray-700">Alerte active</span>
        </div>
      </div>

      {/* Modal Détails Jour Sélectionné */}
      {selectedDate && selectedEvents.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">
                  {new Date(selectedDate).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-blue-100 mt-2">{selectedEvents.length} lot{selectedEvents.length > 1 ? 's' : ''} actif{selectedEvents.length > 1 ? 's' : ''}</p>
            </div>

            <div className="p-6 space-y-4">
              {selectedEvents.map((event, idx) => (
                <div
                  key={idx}
                  className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-5 border-2 border-gray-200 hover:border-blue-400 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">{event.code_lot}</h4>
                      <p className="text-sm text-gray-600">Jour de gavage {event.jour_gavage}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-white text-sm font-semibold ${getStatutColor(event.statut)}`}>
                      {getStatutLabel(event.statut)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <span className="font-semibold">Canards:</span>
                      <span>{event.nombre_canards}</span>
                    </div>
                    {event.has_alerte && (
                      <div className="flex items-center gap-2 text-red-600 font-semibold">
                        <AlertCircle className="w-5 h-5" />
                        Alerte active
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <a
                      href={`/lots/${event.lot_id}/gavage`}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-center transition-colors"
                    >
                      📝 Saisir dose
                    </a>
                    <a
                      href={`/lots/${event.lot_id}/courbes`}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold text-center transition-colors"
                    >
                      📈 Voir courbes
                    </a>
                    <a
                      href={`/analytics?lot=${event.lot_id}`}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold text-center transition-colors"
                    >
                      📊 Analytics
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
