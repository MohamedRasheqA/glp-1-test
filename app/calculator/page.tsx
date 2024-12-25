'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Header } from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AnalysisResult {
  status: string;
  category: string;
  confidence: number;
  analysis: string;
  sources?: string;
  timestamp: string;
}

interface FormattedResponse {
  content: string;
  metadata?: {
    category?: string;
    timestamp?: string;
    confidence?: number;
    sources?: Array<{
      title: string;
      url: string;
    }>;
  };
}

export default function Calculator() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatResponse = (data: AnalysisResult): FormattedResponse => {
    let formattedContent = `
      ${data.analysis.split('\n').map(line => {
        if (line.startsWith('- **')) {
          const [heading, ...descriptionParts] = line.replace('- **', '').split('**:');
          const description = descriptionParts.join('**:').trim();
          return `
            <div class="mb-4">
              <div class="font-semibold">${heading}:</div>
              <div class="ml-4">${description}</div>
            </div>`;
        }
        return `<div class="ml-4 my-2">${line}</div>`;
      }).join('')}
    `;

    return {
      content: formattedContent,
      metadata: {
        category: data.category,
        timestamp: data.timestamp,
        confidence: data.confidence
      }
    };
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setSelectedImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const analyzeImage = async () => {
    if (!selectedImage) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/calculator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: selectedImage }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to analyze image')
      }

      const result = await response.json()
      setAnalysisResult(result)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
      setAnalysisResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 pointer-events-none">
        <div className="area">
          <ul className="circles">
            {[...Array(10)].map((_, index) => (
              <li key={index}></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4 relative z-20">
          <Card className={`h-[80vh] ${analysisResult ? 'w-[95%]' : 'w-[600px]'} mx-auto bg-white/80 backdrop-blur-sm`}>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-[#FE3301] text-center">
                Food Image Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-5rem)] overflow-hidden">
              <div className={`h-full ${analysisResult ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'flex flex-col items-center justify-center'}`}>
                {/* Left Column - Image Upload and Preview */}
                <div className={`space-y-6 ${analysisResult ? 'h-full overflow-y-auto' : 'w-full max-w-md'} flex flex-col items-center`}>
                  <div className="flex justify-center w-64">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="text-sm text-center text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#FE3301] file:text-white file:transition-colors file:hover:bg-[#FE3301]/90 hover:cursor-pointer bg-gray-400/80 rounded-full px-4 py-2"
                    />
                  </div>

                  {selectedImage && (
                    <div className="relative w-64 h-[300px] rounded-lg overflow-hidden shadow-lg transition-transform duration-300 hover:scale-105">
                      <Image
                        src={selectedImage}
                        alt="Selected food image"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                  )}

                  <div className="flex justify-center w-64">
                    <Button
                      onClick={analyzeImage}
                      disabled={!selectedImage || isLoading}
                      className="w-full bg-[#FE3301] text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:bg-[#FE3301]/90 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] active:shadow-md focus:outline-none focus:ring-2 focus:ring-[#FE3301]/50"
                    >
                      <span className="inline-flex items-center justify-center">
                        {isLoading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                            Analyzing...
                          </>
                        ) : (
                          'Analyze Image'
                        )}
                      </span>
                    </Button>
                  </div>
                </div>

                {/* Right Column - Analysis Results */}
                {(error || analysisResult) && (
                  <div className="h-full overflow-y-auto">
                    {error && (
                      <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 animate-fadeIn">
                        {error}
                      </div>
                    )}

                    {analysisResult && (
                      <div className="h-full p-6 space-y-4">
                        <div className="mb-6">
                          <div className="text-lg font-semibold mb-2">Analysis Results</div>
                          <div className="space-y-2">
                            <div className="text-sm">
                              Category: <span className="font-medium">{analysisResult.category}</span>
                            </div>
                            <div className="text-sm">
                              Confidence: <span className="font-medium">{analysisResult.confidence.toFixed(2)}%</span>
                            </div>
                          </div>
                        </div>
                        <div 
                          className="prose max-w-none text-sm"
                          dangerouslySetInnerHTML={{ 
                            __html: formatResponse(analysisResult).content 
                          }}
                        />
                        {analysisResult.timestamp && (
                          <div className="text-xs text-gray-500 mt-4">
                            {new Date(analysisResult.timestamp).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <style jsx global>{`
        .area {
          width: 100%;
          height: 100vh;
          position: absolute;
          top: 0;
          left: 0;
        }

        .circles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          margin: 0;
          padding: 0;
        }

        .circles li {
          position: absolute;
          display: block;
          list-style: none;
          width: 20px;
          height: 20px;
          background: rgba(254, 51, 1, 0.2);
          animation: animate 25s linear infinite;
          bottom: -150px;
          border-radius: 50%;
        }

        .circles li:nth-child(1) {
          left: 25%;
          width: 80px;
          height: 80px;
          animation-delay: 0s;
        }

        .circles li:nth-child(2) {
          left: 10%;
          width: 20px;
          height: 20px;
          animation-delay: 2s;
          animation-duration: 12s;
        }

        .circles li:nth-child(3) {
          left: 70%;
          width: 20px;
          height: 20px;
          animation-delay: 4s;
        }

        .circles li:nth-child(4) {
          left: 40%;
          width: 60px;
          height: 60px;
          animation-delay: 0s;
          animation-duration: 18s;
        }

        .circles li:nth-child(5) {
          left: 65%;
          width: 20px;
          height: 20px;
          animation-delay: 0s;
        }

        .circles li:nth-child(6) {
          left: 75%;
          width: 110px;
          height: 110px;
          animation-delay: 3s;
        }

        .circles li:nth-child(7) {
          left: 35%;
          width: 150px;
          height: 150px;
          animation-delay: 7s;
        }

        .circles li:nth-child(8) {
          left: 50%;
          width: 25px;
          height: 25px;
          animation-delay: 15s;
          animation-duration: 45s;
        }

        .circles li:nth-child(9) {
          left: 20%;
          width: 15px;
          height: 15px;
          animation-delay: 2s;
          animation-duration: 35s;
        }

        .circles li:nth-child(10) {
          left: 85%;
          width: 150px;
          height: 150px;
          animation-delay: 0s;
          animation-duration: 11s;
        }

        @keyframes animate {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.5;
            border-radius: 50%;
          }
          100% {
            transform: translateY(-1000px) rotate(720deg);
            opacity: 0;
            border-radius: 50%;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </>
  )
}