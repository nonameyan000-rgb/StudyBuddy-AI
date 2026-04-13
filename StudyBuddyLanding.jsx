import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Play, FileText, BrainCircuit, Download, Check } from 'lucide-react';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

export default function StudyBuddyLanding() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-gray-900 font-sans selection:bg-red-100 selection:text-red-900 relative">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 cursor-pointer">
              <Zap className="w-6 h-6 text-red-600" />
              <span className="font-bold text-xl tracking-tight">StudyBuddy AI</span>
            </div>
            <nav className="hidden md:flex gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium transition-colors duration-300">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium transition-colors duration-300">Pricing</a>
            </nav>
            <div className="flex items-center gap-4">
              <button className="text-gray-600 hover:text-red-600 font-medium px-4 py-2 rounded-md transition-colors duration-300 hidden sm:block">
                Login
              </button>
              <button className="bg-red-600 text-white font-medium px-5 py-2 rounded-md hover:bg-red-700 transition-all duration-300 hover:shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <motion.section 
          className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center relative"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {/* Subtle Dot Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40 mix-blend-multiply pointer-events-none -z-10"></div>
          
          <div className="max-w-4xl mx-auto">
            <motion.h1
              variants={fadeIn}
              className="text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight"
            >
              Transform Long Reads into <br className="hidden sm:block" />
              <span className="text-red-600">Anki Cards</span> in Seconds.
            </motion.h1>
            <motion.p
              variants={fadeIn}
              className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              The ultimate AI study tool for SAT & IELTS. Upload your textbooks or PDFs, and get instant summaries and interactive flashcards.
            </motion.p>
            <motion.div
              variants={fadeIn}
              className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-20"
            >
              <button className="w-full sm:w-auto bg-red-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-red-700 transition-all duration-300 hover:shadow-[0_0_15px_rgba(220,38,38,0.4)] text-lg">
                Start for Free
              </button>
              <button className="w-full sm:w-auto group flex items-center justify-center gap-2 text-gray-600 font-semibold px-8 py-4 rounded-xl hover:text-red-600 transition-all duration-300 text-lg bg-white border border-gray-200 hover:border-red-200 hover:shadow-sm">
                <Play className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
                Watch Demo
              </button>
            </motion.div>

            {/* Dashboard Preview */}
            <motion.div
              variants={fadeIn}
              className="relative mx-auto rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300 p-4 sm:p-6 overflow-hidden max-w-5xl"
            >
              <div className="flex flex-col md:flex-row gap-6">
                {/* Fake PDF Side */}
                <div className="flex-1 bg-white border border-gray-100 rounded-xl p-6 text-left relative overflow-hidden">
                  <div className="h-4 w-1/3 bg-gray-200 rounded mb-6"></div>
                  <div className="space-y-3">
                    <div className="h-3 w-full bg-gray-100 rounded"></div>
                    <div className="h-3 w-full bg-gray-100 rounded"></div>
                    <div className="h-3 w-5/6 bg-gray-100 rounded"></div>
                    <div className="h-3 w-full bg-gray-100 rounded"></div>
                    <div className="h-3 w-4/5 bg-gray-100 rounded"></div>
                  </div>
                  <div className="mt-8 space-y-3">
                    <div className="h-3 w-full bg-gray-100 rounded"></div>
                    <div className="h-3 w-5/6 bg-gray-100 rounded"></div>
                  </div>
                </div>
                {/* Fake Anki Side */}
                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex-1 bg-white border border-gray-100 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group transition-all duration-300 hover:border-red-100">
                    <span className="text-xs text-gray-400 font-bold tracking-wider uppercase mb-2">Front</span>
                    <h3 className="text-lg font-bold text-gray-900 text-center mb-6">What is Mitochondria?</h3>
                    <div className="w-full border-t border-dashed border-gray-200 mb-6"></div>
                    <span className="text-xs text-gray-400 font-bold tracking-wider uppercase mb-2">Back</span>
                    <p className="text-gray-600 text-center text-sm font-medium">
                      The powerhouse of the cell, responsible for cellular respiration and energy production.
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <div className="h-10 w-24 bg-gray-50 rounded-lg border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors flex items-center justify-center text-xs font-semibold text-gray-500 cursor-pointer">Again</div>
                    <div className="h-10 w-24 bg-gray-50 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-colors flex items-center justify-center text-xs font-semibold text-gray-500 cursor-pointer">Good</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Features Section */}
        <motion.section 
          id="features" 
          className="py-24 bg-white border-y border-gray-200"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div variants={fadeIn} className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Stop writing. Start learning.</h2>
              <p className="text-lg text-gray-600">Three simple steps to maximize your study efficiency.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <motion.div
                variants={fadeIn}
                className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300"
              >
                <div className="w-12 h-12 bg-gray-50 text-gray-900 rounded-xl flex items-center justify-center mb-6 border border-gray-200">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">1. Upload Material</h3>
                <p className="text-gray-600 leading-relaxed">
                  Drop your PDF textbooks, lecture notes, or long-reads directly into our system.
                </p>
              </motion.div>

              {/* Feature 2 */}
              <motion.div
                variants={fadeIn}
                className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300"
              >
                <div className="w-12 h-12 bg-gray-50 text-red-600 rounded-xl flex items-center justify-center mb-6 border border-gray-200">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">2. AI Analysis</h3>
                <p className="text-gray-600 leading-relaxed">
                  Our engine extracts key terms, formulas, and concepts automatically with high precision.
                </p>
              </motion.div>

              {/* Feature 3 */}
              <motion.div
                variants={fadeIn}
                className="bg-white border border-gray-200 p-8 rounded-2xl shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300"
              >
                <div className="w-12 h-12 bg-gray-50 text-gray-900 rounded-xl flex items-center justify-center mb-6 border border-gray-200">
                  <Download className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">3. Export to Anki</h3>
                <p className="text-gray-600 leading-relaxed">
                  Download a ready-to-use CSV deck or instantly study directly within our built-in app.
                </p>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Pricing Section */}
        <motion.section 
          id="pricing" 
          className="py-24 bg-[#fafafa]"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div variants={fadeIn} className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Simple, transparent pricing.</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-center">
              {/* Free Plan */}
              <motion.div
                variants={fadeIn}
                className="border border-gray-200 rounded-2xl p-8 flex flex-col bg-white shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300"
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Basic</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">Free</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-gray-600">
                    <Check className="w-5 h-5 text-gray-400" />
                    10 pages/month
                  </li>
                  <li className="flex items-center gap-3 text-gray-600">
                    <Check className="w-5 h-5 text-gray-400" />
                    Basic AI summaries
                  </li>
                  <li className="flex items-center gap-3 text-gray-600">
                    <Check className="w-5 h-5 text-gray-400" />
                    Standard export
                  </li>
                </ul>
                <button className="w-full border border-gray-200 text-gray-900 font-semibold py-3 rounded-xl hover:border-gray-900 hover:bg-gray-50 transition-all duration-300">
                  Start Free
                </button>
              </motion.div>

              {/* Pro Plan */}
              <motion.div
                variants={fadeIn}
                className="border-2 border-red-600 rounded-2xl p-8 flex flex-col bg-white relative shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 md:scale-105 z-10"
              >
                <div className="absolute top-0 right-8 -translate-y-1/2 bg-red-600 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                  Most Popular
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Pro</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">$9.99</span>
                  <span className="text-gray-500 font-medium">/mo</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-gray-900">
                    <Check className="w-5 h-5 text-red-600" />
                    100 pages/month
                  </li>
                  <li className="flex items-center gap-3 text-gray-900">
                    <Check className="w-5 h-5 text-red-600" />
                    Advanced SAT/IELTS vocabulary extraction
                  </li>
                  <li className="flex items-center gap-3 text-gray-900">
                    <Check className="w-5 h-5 text-red-600" />
                    Priority support
                  </li>
                </ul>
                <button className="w-full bg-red-600 text-white font-semibold py-3 rounded-xl hover:bg-red-700 transition-all duration-300 hover:shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                  Upgrade to Pro
                </button>
              </motion.div>
            </div>
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-600" />
              <span className="font-bold text-lg tracking-tight">StudyBuddy AI</span>
            </div>
            <p className="text-gray-500 text-sm">
              &copy; 2026 StudyBuddy AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
