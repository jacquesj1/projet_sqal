import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface ErrorMessageProps {
  title?: string
  message: string
  actionButton?: React.ReactNode
}

export function ErrorMessage({ 
  title = "Une erreur est survenue", 
  message, 
  actionButton 
}: ErrorMessageProps) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-red-900 mb-2">{title}</h3>
        <p className="text-red-700 mb-6 max-w-md mx-auto">{message}</p>
        {actionButton}
      </CardContent>
    </Card>
  )
}