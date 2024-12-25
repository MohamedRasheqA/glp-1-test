import React from 'react';
import { Card } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

const FAQCard: React.FC<{ question: string; answer: string }> = ({ question, answer }) => (
  <Card className="relative overflow-hidden border-gray-200 hover:shadow-lg transition-all duration-300 group">
    <div className="p-6 bg-white">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-[#FE3301]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#FE3301]/20 transition-colors">
          <HelpCircle size={28} className="text-[#FE3301]" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-black mb-2">{question}</h3>
          <p className="text-gray-700">{answer}</p>
        </div>
      </div>
    </div>
  </Card>
);

const FAQSection: React.FC = () => {
  const faqs = [
    {
      question: "How do GLP-1 medications work?",
      answer: "GLP-1s help produce more of this hormone, impact hunger signaling, and slow down gastric emptying. This can lead to feeling 'full' for longer periods, making it easier to manage food intake."
    },
    {
      question: "What are the benefits of GLP-1 medications?",
      answer: "GLP-1 medications can impact overall longevity and well-being. However, without integration with behavioral medicine and lifestyle changes, these benefits will likely end when patients stop taking GLP-1 medications."
    },
    {
      question: "What are the most common side effects?",
      answer: "The most common side effects include nausea, vomiting, diarrhea, stomach pain, low appetite, fatigue, and dizziness. There is also a risk of low blood sugar, which is more likely if you take other medications to manage blood sugar."
    },
    {
      question: "What happens if I don't take this medication?",
      answer: "This depends on why GLP-1 medications were recommended to you. If you choose not to take them, you may continue to have the same health status with regards to your diabetes, weight, or liver function."
    }
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-[#FE3301] text-3xl md:text-4xl font-bold mb-12 text-center font-sans">
          Frequently Asked Questions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {faqs.map((faq, index) => (
            <FAQCard key={index} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;