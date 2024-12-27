'use client'

import React from 'react'
import { useState, useEffect, useRef } from 'react'
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
  id: string;
}

interface PendingAnalysis {
  id: string;
  image: string;
  timestamp: number;
  retryCount: number;
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

// Global state with a single source of truth
const globalState = {
  selectedImage: null as string | null,
  analysisResults: [] as AnalysisResult[],
  pendingAnalyses: new Map<string, PendingAnalysis>(),
  isProcessing: false,
  isAnalyzing: false,
};

// Constants
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 300000;
const generateId = () => Math.random().toString(36).substr(2, 9);

const MessageContent = ({ content }: { content: string }) => {
  const formatText = (text: string) => {
    // Split text into lines and filter out empty lines
    return text.split('\n').filter(line => line.trim()).map((line, i, arr) => {
      // Check if line starts with a single asterisk
      if (line.trim().startsWith('* ')) {
        const bulletContent = line.trim().substring(2);
        const formattedBullet = bulletContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', alignItems: 'start', marginBottom: '4px' }}>
              <span style={{ marginRight: '8px' }}>•</span>
              <span dangerouslySetInnerHTML={{ __html: formattedBullet }} />
            </div>
          </React.Fragment>
        );
      }

      // Handle regular lines with bold text
      const boldText = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return (
        <React.Fragment key={i}>
          <span dangerouslySetInnerHTML={{ __html: boldText }} />
          {i < arr.length - 1 && <div style={{ marginBottom: '4px' }} />}
        </React.Fragment>
      );
    });
  };

  return <div style={{ lineHeight: '1.4' }}>{formatText(content)}</div>;
};

export default function Calculator() {
  const [selectedImage, setSelectedImage] = useState<string | null>(globalState.selectedImage)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>(globalState.analysisResults)
  const [isLoading, setIsLoading] = useState(globalState.isAnalyzing)
  const [error, setError] = useState<string | null>(null)
  const processingRef = useRef<boolean>(false)

  const processAnalyses = async () => {
    if (processingRef.current) return;
    
    processingRef.current = true;
    globalState.isProcessing = true;

    try {
      while (globalState.pendingAnalyses.size > 0) {
        const [firstAnalysisId, firstAnalysis] = Array.from(globalState.pendingAnalyses.entries())[0];
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

          const response = await fetch('/api/calculator', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: firstAnalysis.image }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error('Failed to analyze image');
          }

          const result = await response.json();
          const analysisResult: AnalysisResult = {
            ...result,
            id: firstAnalysisId,
            timestamp: new Date().toISOString(),
          };

          globalState.analysisResults = [...globalState.analysisResults, analysisResult];
          setAnalysisResults(globalState.analysisResults);
          globalState.pendingAnalyses.delete(firstAnalysisId);
          
        } catch (error) {
          console.error('Error processing analysis:', error);
          
          if (firstAnalysis.retryCount < MAX_RETRIES) {
            firstAnalysis.retryCount += 1;
            firstAnalysis.timestamp = Date.now();
            globalState.pendingAnalyses.delete(firstAnalysisId);
            globalState.pendingAnalyses.set(firstAnalysisId, firstAnalysis);
          } else {
            setError('Failed to analyze image after multiple attempts. Please try again.');
            globalState.pendingAnalyses.delete(firstAnalysisId);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      processingRef.current = false;
      globalState.isProcessing = false;
      globalState.isAnalyzing = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      setSelectedImage(globalState.selectedImage);
      setAnalysisResults(globalState.analysisResults);
      setIsLoading(globalState.isAnalyzing);
      
      if (!document.hidden && globalState.pendingAnalyses.size > 0 && !globalState.isProcessing) {
        processAnalyses();
      }
    };

    if (globalState.pendingAnalyses.size > 0 && !globalState.isProcessing) {
      processAnalyses();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  const formatResponse = (data: AnalysisResult): FormattedResponse => {
    return {
      content: data.analysis,
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
        const imageString = reader.result as string;
        setSelectedImage(imageString);
        globalState.selectedImage = imageString;
        // Clear previous results
        setAnalysisResults([]);
        globalState.analysisResults = [];
        setError(null);
      }
      reader.readAsDataURL(file)
    }
  }

  const analyzeImage = async () => {
    if (!selectedImage) return;

    setError(null);
    setIsLoading(true);
    globalState.isAnalyzing = true;

    const analysisId = generateId();
    const pendingAnalysis: PendingAnalysis = {
      id: analysisId,
      image: selectedImage,
      timestamp: Date.now(),
      retryCount: 0,
    };

    globalState.pendingAnalyses.set(analysisId, pendingAnalysis);

    if (!globalState.isProcessing) {
      processAnalyses();
    }
  };

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
          <Card className={`h-[90vh] sm:h-[80vh] ${analysisResults.length > 0 ? 'w-[95%]' : 'w-[600px]'} mx-auto bg-white/80 backdrop-blur-sm`}>
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl font-bold text-[#FE3301] text-center">
                Meal Analyzer
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-4rem)] sm:h-[calc(100%-5rem)] overflow-hidden">
              <div className={`h-full ${analysisResults.length > 0 ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'flex flex-col items-center justify-center'}`}>
                {/* Left Column - Image Upload and Preview */}
                <div className="flex flex-col items-center gap-6 w-full max-w-[300px] mx-auto after:content-none before:content-none border-0 divide-none">
                  <div className="flex justify-center w-full after:content-none before:content-none border-0">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="w-full text-sm text-center text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#FE3301] file:text-white file:transition-colors file:hover:bg-[#FE3301]/90 hover:cursor-pointer bg-gray-400/80 rounded-full px-4 py-2"
                    />
                  </div>

                  {selectedImage && (
                    <div className="relative w-64 h-[300px] rounded-lg overflow-hidden shadow-lg transition-transform duration-300 hover:scale-105 after:content-none before:content-none border-0">
                      <Image
                        src={selectedImage}
                        alt="Selected food image"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                  )}

                  <div className="flex justify-center w-64 after:content-none before:content-none border-0">
                    <Button
                      onClick={analyzeImage}
                      disabled={!selectedImage || isLoading}
                      className="w-full bg-[#FE3301] text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:bg-[#FE3301]/90 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] active:shadow-md focus:outline-none focus:ring-2 focus:ring-[#FE3301]/50 after:content-none before:content-none border-0 shadow-none"
                    >
                      <span className="inline-flex items-center justify-center after:content-none before:content-none">
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
                {(error || analysisResults.length > 0) && (
                  <div className="h-full overflow-y-auto after:content-none before:content-none border-0">
                    {error && (
                      <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 animate-fadeIn">
                        {error}
                      </div>
                    )}
                    {analysisResults.map((result) => (
                      <div key={result.id}>
                        <div>
                          <div>Analysis Results</div>
                          <div>
                            <div>
                              <strong>Category:</strong> {result.category}
                            </div>
                            <div>
                              <strong>Confidence:</strong> {result.confidence.toFixed(2)}%
                            </div>
                            <div>
                              <strong>Status:</strong> {result.status}
                            </div>
                            <div>
                              <strong>Timestamp:</strong> {new Date(result.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div>
                          <MessageContent content={result.analysis} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <style jsx global>{`
        .area {
          background: white;
          width: 100%;
          height: 100vh;
          position: absolute;
          z-index: 1;
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
          background: rgba(254, 51, 1, 0.1);
          animation: animate 25s linear infinite;
          bottom: -150px;
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
            opacity: 1;
            border-radius: 0;
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
          animation: fadeIn 0.5s ease-out forwards;
        }

        /* Custom scrollbar styles */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: #FE3301;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #cc2901;
        }

        /* Add these styles to remove any potential divider lines */
        .divide-y > :not([hidden]) ~ :not([hidden]),
        .divide-x > :not([hidden]) ~ :not([hidden]) {
          --tw-divide-y-reverse: 0;
          --tw-divide-x-reverse: 0;
          border-top-width: 0;
          border-bottom-width: 0;
          border-left-width: 0;
          border-right-width: 0;
        }
      `}</style>
    </>
  );
}
