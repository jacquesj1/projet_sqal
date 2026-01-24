// ============================================================================
// Blockchain Certifications Page - Liste des certifications blockchain
// ============================================================================

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { BlockchainQRCode } from "@components/common/BlockchainQRCode";
import {
  Shield,
  Download,
  RefreshCw,
  Calendar,
  Package,
  User,
  MapPin,
  Award,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useRealtimeStore } from "@stores/realtimeStore";

interface BlockchainCertification {
  sample_id: string;
  blockchain_hash: string;
  blockchain_timestamp: string;
  qr_code_base64?: string;
  lot_abattage?: string;
  eleveur?: string;
  provenance?: string;
  grade: string;
  quality_score: number;
  timestamp: string;
}

export default function BlockchainPage() {
  const { fusionHistory } = useRealtimeStore();
  const [certifications, setCertifications] = useState<BlockchainCertification[]>([]);
  const [selectedCert, setSelectedCert] = useState<BlockchainCertification | null>(null);
  const [filterGrade, setFilterGrade] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Extraire les certifications depuis les données temps réel
  useEffect(() => {
    const certs: BlockchainCertification[] = [];

    fusionHistory.forEach((fusion) => {
      if (fusion.blockchain?.blockchain_hash) {
        certs.push({
          sample_id: fusion.sample_id || "N/A",
          blockchain_hash: fusion.blockchain.blockchain_hash,
          blockchain_timestamp: fusion.blockchain.blockchain_timestamp || fusion.timestamp || "",
          qr_code_base64: fusion.blockchain.qr_code_base64,
          lot_abattage: fusion.blockchain.lot_abattage,
          eleveur: fusion.blockchain.eleveur,
          provenance: fusion.blockchain.provenance,
          grade: fusion.final_grade || "UNKNOWN",
          quality_score: fusion.final_score || 0,
          timestamp: fusion.timestamp || "",
        });
      }
    });

    // Trier par date décroissante (plus récent en premier)
    certs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setCertifications(certs);

    // Sélectionner automatiquement la plus récente
    if (certs.length > 0 && !selectedCert) {
      setSelectedCert(certs[0]);
    }
  }, [fusionHistory, selectedCert]);

  // Filtrer les certifications
  const filteredCertifications = certifications.filter((cert) => {
    const matchGrade = filterGrade === "ALL" || cert.grade === filterGrade;
    const matchSearch =
      searchTerm === "" ||
      cert.sample_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.lot_abattage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.eleveur?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchGrade && matchSearch;
  });

  const toggleCardExpansion = (hash: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) {
        next.delete(hash);
      } else {
        next.add(hash);
      }
      return next;
    });
  };

  const getGradeBadgeColor = (grade: string) => {
    switch (grade) {
      case "A+":
      case "A":
        return "bg-green-500";
      case "B":
        return "bg-yellow-500";
      case "C":
        return "bg-orange-500";
      case "REJECT":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const exportAllCertifications = () => {
    const data = JSON.stringify(certifications, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `blockchain-certifications-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-purple-500" />
            Certifications Blockchain
          </h1>
          <p className="text-muted-foreground mt-1">
            Traçabilité et authentification des analyses qualité
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button onClick={exportAllCertifications} disabled={certifications.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exporter Tout
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Certifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{certifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Grade A</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {certifications.filter((c) => c.grade === "A" || c.grade === "A+").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Grade B/C</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {certifications.filter((c) => c.grade === "B" || c.grade === "C").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Rejetés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {certifications.filter((c) => c.grade === "REJECT").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher (ID, lot, éleveur)..."
                  className="w-full pl-10 pr-4 py-2 border rounded-md"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Grade Filter */}
            <div className="flex gap-2">
              {["ALL", "A", "B", "C", "REJECT"].map((grade) => (
                <Button
                  key={grade}
                  size="sm"
                  variant={filterGrade === grade ? "default" : "outline"}
                  onClick={() => setFilterGrade(grade)}
                >
                  {grade === "ALL" ? "Tous" : grade}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste des certifications */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Certifications ({filteredCertifications.length})
              </CardTitle>
              <CardDescription>
                Cliquez sur une certification pour voir les détails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredCertifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune certification trouvée</p>
                  <p className="text-sm mt-2">
                    Les certifications apparaîtront ici lorsque des échantillons seront analysés
                  </p>
                </div>
              ) : (
                filteredCertifications.map((cert) => {
                  const isExpanded = expandedCards.has(cert.blockchain_hash);

                  return (
                    <Card
                      key={cert.blockchain_hash}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedCert?.blockchain_hash === cert.blockchain_hash
                          ? "ring-2 ring-purple-500"
                          : ""
                      }`}
                      onClick={() => setSelectedCert(cert)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getGradeBadgeColor(cert.grade)}>
                                {cert.grade}
                              </Badge>
                              <span className="text-sm font-mono text-muted-foreground">
                                {cert.sample_id}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {cert.lot_abattage && (
                                <div className="flex items-center gap-1">
                                  <Package className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs">{cert.lot_abattage}</span>
                                </div>
                              )}
                              {cert.eleveur && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs">{cert.eleveur}</span>
                                </div>
                              )}
                              {cert.provenance && (
                                <div className="flex items-center gap-1 col-span-2">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs">{cert.provenance}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1 col-span-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs">
                                  {new Date(cert.timestamp).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {/* Expandable hash */}
                            <div className="mt-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCardExpansion(cert.blockchain_hash);
                                }}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-3 w-3 mr-1" />
                                    Masquer hash
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3 mr-1" />
                                    Voir hash
                                  </>
                                )}
                              </Button>
                              {isExpanded && (
                                <code className="block mt-2 p-2 bg-muted rounded text-xs font-mono break-all">
                                  {cert.blockchain_hash}
                                </code>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <Award className="h-5 w-5 text-purple-500" />
                            <span className="text-lg font-bold">
                              {(cert.quality_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Détails certification sélectionnée */}
        <div className="lg:col-span-1">
          {selectedCert ? (
            <BlockchainQRCode
              blockchainHash={selectedCert.blockchain_hash}
              data={{
                lot_abattage: selectedCert.lot_abattage,
                eleveur: selectedCert.eleveur,
                provenance: selectedCert.provenance,
                timestamp: selectedCert.blockchain_timestamp,
                grade: selectedCert.grade,
              }}
              size={256}
              showDetails={true}
            />
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Sélectionnez une certification</p>
                <p className="text-sm mt-2">pour voir le QR code et les détails</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
