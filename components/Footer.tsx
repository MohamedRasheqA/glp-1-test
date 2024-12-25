"use client";

import React from 'react';
import Link from 'next/link';
import { Twitter, Linkedin, ArrowUpRight } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="relative bg-white py-8 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-32 h-32 rounded-full bg-[#FE3301]/5 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full bg-[#FE3301]/5 translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Social Links with hover effects */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="group">
            <h3 className="text-[#FE3301] font-semibold mb-3 text-lg">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="flex items-center text-gray-600 hover:text-[#FE3301] transition-colors group">
                  Features
                  <ArrowUpRight className="h-4 w-4 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link href="#" className="flex items-center text-gray-600 hover:text-[#FE3301] transition-colors group">
                  Pricing
                  <ArrowUpRight className="h-4 w-4 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="group">
            <h3 className="text-[#FE3301] font-semibold mb-3 text-lg">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="flex items-center text-gray-600 hover:text-[#FE3301] transition-colors group">
                  About
                  <ArrowUpRight className="h-4 w-4 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link href="#" className="flex items-center text-gray-600 hover:text-[#FE3301] transition-colors group">
                  Contact
                  <ArrowUpRight className="h-4 w-4 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="group">
            <h3 className="text-[#FE3301] font-semibold mb-3 text-lg">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="flex items-center text-gray-600 hover:text-[#FE3301] transition-colors group">
                  Blog
                  <ArrowUpRight className="h-4 w-4 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link href="#" className="flex items-center text-gray-600 hover:text-[#FE3301] transition-colors group">
                  FAQ
                  <ArrowUpRight className="h-4 w-4 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="group">
            <h3 className="text-[#FE3301] font-semibold mb-3 text-lg">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="flex items-center text-gray-600 hover:text-[#FE3301] transition-colors group">
                  Privacy
                  <ArrowUpRight className="h-4 w-4 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
              <li>
                <Link href="#" className="flex items-center text-gray-600 hover:text-[#FE3301] transition-colors group">
                  Terms
                  <ArrowUpRight className="h-4 w-4 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" />
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar with enhanced hover effects */}
        <div className="border-t border-gray-200 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-600 mb-4 md:mb-0">
            © {new Date().getFullYear()} GLP-1 Assistant. All rights reserved.
          </p>
          <div className="flex items-center space-x-6">
            <a 
              href="https://twitter.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="group relative text-gray-600 hover:text-[#FE3301] transition-colors"
            >
              <Twitter className="h-5 w-5 transform group-hover:scale-110 transition-transform" />
            </a>
            <a 
              href="https://linkedin.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="group relative text-gray-600 hover:text-[#FE3301] transition-colors"
            >
              <Linkedin className="h-5 w-5 transform group-hover:scale-110 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;