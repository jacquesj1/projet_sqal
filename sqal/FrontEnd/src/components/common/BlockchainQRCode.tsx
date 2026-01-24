// ============================================================================
// SQAL Frontend - Blockchain QR Code Component
// Génération et affichage de QR codes pour la traçabilité blockchain
// ============================================================================

import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Download, Copy, CheckCircle2, Shield } from "lucide-react";
import { useState } from "react";

interface BlockchainQRCodeProps {
  blockchainHash: string;
  data?: {
    lot_abattage?: string;
    eleveur?: string;
    provenance?: string;
    timestamp?: string;
    grade?: string;
  };
  size?: number;
  showDetails?: boolean;
}

export function BlockchainQRCode({
  blockchainHash,
  data,
  size = 256,
  showDetails = true,
}: BlockchainQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current && blockchainHash) {
      // Generate QR code with blockchain hash
      QRCode.toCanvas(
        canvasRef.current,
        blockchainHash,
        {
          width: size,
          margin: 2,
          color: {
            dark: "#1e293b",
            light: "#ffffff",
          },
        },
        (error) => {
          if (error) console.error("QR Code generation error:", error);
        }
      );
    }
  }, [blockchainHash, size]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(blockchainHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownload = () => {
    if (canvasRef.current) {
      const url = canvasRef.current.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `blockchain-qr-${blockchainHash.slice(0, 8)}.png`;
      link.href = url;
      link.click();
    }
  };

  return (
    <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Shield className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Traçabilité Blockchain</CardTitle>
              <CardDescription>QR Code de certification</CardDescription>
            </div>
          </div>
          <Badge className="bg-green-500 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Certifié
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code */}
        <div className="flex justify-center p-4 bg-white rounded-lg border-2 border-purple-500/20">
          <canvas ref={canvasRef} />
        </div>

        {/* Blockchain Hash */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Hash Blockchain
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 text-xs bg-muted rounded-lg font-mono break-all">
              {blockchainHash}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Data Details */}
        {showDetails && data && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Informations de traçabilité
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {data.lot_abattage && (
                <div>
                  <p className="text-muted-foreground text-xs">Lot d'abattage</p>
                  <p className="font-semibold">{data.lot_abattage}</p>
                </div>
              )}
              {data.eleveur && (
                <div>
                  <p className="text-muted-foreground text-xs">Éleveur</p>
                  <p className="font-semibold">{data.eleveur}</p>
                </div>
              )}
              {data.provenance && (
                <div>
                  <p className="text-muted-foreground text-xs">Provenance</p>
                  <p className="font-semibold">{data.provenance}</p>
                </div>
              )}
              {data.grade && (
                <div>
                  <p className="text-muted-foreground text-xs">Grade</p>
                  <Badge variant="outline">{data.grade}</Badge>
                </div>
              )}
              {data.timestamp && (
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Horodatage</p>
                  <p className="font-semibold text-xs">
                    {new Date(data.timestamp).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4 mr-2" />
            Télécharger QR
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCopy}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copier Hash
          </Button>
        </div>

        {/* Verification Link */}
        <div className="text-center pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            🔗 Vérifiez l'authenticité sur la blockchain publique
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
