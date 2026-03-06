import Link from "next/link";
import Image from "next/image";
import {
  Play,
  Video,
  Hospital,
  Activity,
  Target,
  Home,
  FileText,
  Camera,
  ShieldCheck,
  ArrowRight,
  Clock,
  Calendar,
  Lightbulb,
  Brain,
  RotateCcw,
  BookOpen,
  Heart,
  Users,
  ChevronRight,
} from "lucide-react";
import { PROCEDURE_TYPES, RECORDING_CATEGORIES, CHRONIC_PAIN_CONDITIONS } from "@/lib/constants";
import ContentPreviewSection from "@/components/ContentPreviewSection";
import HeroCTA from "@/components/HeroCTA";
import GuideCTA from "@/components/GuideCTA";
import FooterGuideLinks from "@/components/FooterGuideLinks";
import FooterSeekerLinks from "@/components/FooterSeekerLinks";
import FeatureRequestButton from "@/components/FeatureRequestButton";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import ScrollReveal from "@/components/landing/ScrollReveal";

const categoryIcons: Record<string, React.ReactNode> = {
  WEEKLY_TIMELINE: <Calendar className="w-5 h-5" />,
  WISH_I_KNEW: <Lightbulb className="w-5 h-5" />,
  PRACTICAL_TIPS: <BookOpen className="w-5 h-5" />,
  MENTAL_HEALTH: <Brain className="w-5 h-5" />,
  RETURN_TO_ACTIVITY: <Activity className="w-5 h-5" />,
  MISTAKES_AND_LESSONS: <RotateCcw className="w-5 h-5" />,
};

export default function HomePage() {
  return (
    <div>
      {/* Skip to content - accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:text-teal-700 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-teal-500">
        Skip to main content
      </a>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800 text-white overflow-hidden">
        {/* Subtle mesh overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.08)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(6,182,212,0.15)_0%,_transparent_50%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-5 gap-12 items-center">
            {/* Text side */}
            <div className="lg:col-span-3">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 animate-fade-in-up">
                Guidance from people who&apos;ve
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-cyan-200">
                  {" "}actually been through it
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-teal-100/90 mb-8 leading-relaxed max-w-2xl">
                Your doctor tells you what to expect medically. We connect you with
                real people who match your age, activity level, and goals — so you
                know what it actually feels like.
              </p>
              <HeroCTA />

              {/* Trust strip */}
              <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-teal-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Every guide verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  <span>Free stories & recordings</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>26+ conditions supported</span>
                </div>
              </div>
            </div>

            {/* Visual side — inspired by Stitch mockups */}
            <div className="lg:col-span-2 hidden lg:flex items-center justify-center">
              <div className="relative w-full max-w-sm">
                {/* Ambient glow */}
                <div className="absolute -top-6 -left-6 w-32 h-32 bg-teal-500/20 rounded-full blur-xl" />
                <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-cyan-400/15 rounded-full blur-xl" />

                <div className="relative space-y-4">
                  {/* Guide card preview */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 bg-gradient-to-br from-teal-400 to-cyan-400 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Sarah Jenkins</div>
                        <div className="text-xs text-teal-200/80">Matched Guide &middot; ACL Recovery</div>
                      </div>
                    </div>
                    <p className="text-xs text-teal-100/70 italic leading-relaxed">
                      &ldquo;I know exactly how you&apos;re feeling right now. Let&apos;s walk through this together.&rdquo;
                    </p>
                  </div>

                  {/* Guide card preview — mirrors real guide card UI */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-400 rounded-full flex items-center justify-center text-sm font-bold">
                        M
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold">Mike T.</span>
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
                        </div>
                        <div className="text-xs text-teal-200/70">ACL Reconstruction</div>
                      </div>
                      <div className="text-xs text-teal-300 font-medium">92% match</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                        Available
                      </span>
                      <span className="text-xs bg-white/10 text-teal-200/70 px-2 py-0.5 rounded-full">Age 25-34</span>
                      <span className="text-xs bg-white/10 text-teal-200/70 px-2 py-0.5 rounded-full">Active</span>
                    </div>
                  </div>

                  {/* Live call preview */}
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 bg-emerald-500/25 rounded-full flex items-center justify-center">
                            <Video className="w-5 h-5 text-emerald-300" />
                          </div>
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-teal-800" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">Live Guide Call</div>
                          <div className="text-xs text-teal-200/70">1-on-1 video session</div>
                        </div>
                      </div>
                      <span className="text-xs bg-white/15 text-teal-200 px-3 py-1.5 rounded-full">
                        Join Now
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="main-content" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">How Kizu Works</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Free peer support, designed to give you exactly the
                guidance you need.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <ScrollReveal delay={1}>
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm hover:shadow-xl transition-all duration-300 h-full">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
                    1
                  </div>
                  <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center">
                    <Play className="w-6 h-6 text-teal-600" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2">Watch Real Stories</h3>
                <p className="text-gray-600 mb-4">
                  Browse structured voice and video recordings from real people,
                  filtered to match your profile. Available anytime.
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-teal-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-teal-600 text-xs font-bold">&#10003;</span>
                    </span>
                    Recovery and management timelines
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-teal-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-teal-600 text-xs font-bold">&#10003;</span>
                    </span>
                    Practical tips and lessons learned
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-teal-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-teal-600 text-xs font-bold">&#10003;</span>
                    </span>
                    Matched to your demographics and goals
                  </li>
                </ul>
                <Link
                  href="/watch"
                  className="inline-flex items-center gap-2 text-teal-700 font-semibold hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded group/link cursor-pointer"
                >
                  Browse Recordings
                  <ChevronRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={2}>
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm hover:shadow-xl transition-all duration-300 h-full">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-10 h-10 bg-cyan-600 text-white rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
                    2
                  </div>
                  <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center">
                    <Video className="w-6 h-6 text-cyan-600" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2">Book a Live Guide Call</h3>
                <p className="text-gray-600 mb-4">
                  Book a personal video call with someone who&apos;s been through the same thing.
                  Ask questions, get specific advice, feel supported.
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-cyan-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-cyan-600 text-xs font-bold">&#10003;</span>
                    </span>
                    30 or 60 minute sessions
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-cyan-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-cyan-600 text-xs font-bold">&#10003;</span>
                    </span>
                    Submit questions in advance
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-cyan-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-cyan-600 text-xs font-bold">&#10003;</span>
                    </span>
                    Real-time, personal connection
                  </li>
                </ul>
                <Link
                  href="/guides"
                  className="inline-flex items-center gap-2 text-cyan-700 font-semibold hover:text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 rounded group/link cursor-pointer"
                >
                  Find a Guide
                  <ChevronRight className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Content Preview Section */}
      <ContentPreviewSection />

      {/* Profile Matching */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Same Condition, Different Journey
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                A 28-year-old runner recovering from ACL reconstruction needs different
                guidance than a 65-year-old returning to golf after a total knee replacement.
                Someone newly diagnosed with fibromyalgia needs different advice than
                someone managing CRPS for a decade. We match you with people in your situation.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { label: "Condition type", icon: Hospital, desc: "Same condition, same context", color: "teal" },
              { label: "Age & activity", icon: Activity, desc: "Similar physical profile", color: "cyan" },
              { label: "Recovery goals", icon: Target, desc: "What 'recovered' means to you", color: "emerald" },
              { label: "Life situation", icon: Home, desc: "Kids, job, living situation", color: "blue" },
            ].map((item, i) => (
              <ScrollReveal key={item.label} delay={Math.min(i + 1, 3)}>
                <div className="text-center p-6 rounded-2xl hover:bg-gray-50 transition-all duration-300 cursor-default group">
                  <div className={`w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${
                    item.color === "teal" ? "bg-teal-50 text-teal-600" :
                    item.color === "cyan" ? "bg-cyan-50 text-cyan-600" :
                    item.color === "emerald" ? "bg-emerald-50 text-emerald-600" :
                    "bg-blue-50 text-blue-600"
                  }`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h4 className="font-semibold mb-1">{item.label}</h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Verification */}
      <section className="bg-gradient-to-br from-green-50 to-teal-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Every Guide is Vetted</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                We review every guide before they can publish content or take calls.
                When you see the Verified badge, you know they&apos;ve been through our process.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto relative">
            {/* Connecting line (desktop) */}
            <div className="hidden sm:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-teal-200 via-teal-300 to-green-200" />

            {[
              {
                step: 1,
                icon: FileText,
                title: "Written Application",
                desc: "Guides describe their experience and what they want to share",
                iconBg: "bg-teal-100",
                iconColor: "text-teal-600",
              },
              {
                step: 2,
                icon: Camera,
                title: "Video Interview",
                desc: "A brief call with our team to verify their story and approach",
                iconBg: "bg-teal-100",
                iconColor: "text-teal-600",
              },
              {
                step: 3,
                icon: ShieldCheck,
                title: "Verified Badge",
                desc: "Approved guides display a Verified badge visible to all seekers",
                iconBg: "bg-green-100",
                iconColor: "text-green-600",
              },
            ].map((item, i) => (
              <ScrollReveal key={item.title} delay={Math.min(i + 1, 3)}>
                <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm hover:shadow-lg transition-all duration-300 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 bg-teal-600 text-white rounded-full flex items-center justify-center text-sm font-bold z-10">
                    {item.step}
                  </div>
                  <div className={`w-14 h-14 ${item.iconBg} rounded-xl flex items-center justify-center mx-auto mb-4 mt-2`}>
                    <item.icon className={`w-7 h-7 ${item.iconColor}`} />
                  </div>
                  <h4 className="font-semibold mb-2">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Conditions */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Supported Conditions</h2>
              <p className="text-gray-600">Surgery recovery and autoimmune conditions, expanding based on demand.</p>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="max-w-4xl mx-auto space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 text-center">Surgeries</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {PROCEDURE_TYPES.map((proc) => (
                    <Link
                      key={proc}
                      href={`/watch?procedure=${encodeURIComponent(proc)}`}
                      className="bg-white border border-gray-200 rounded-full px-5 py-2.5 min-h-[44px] flex items-center text-sm font-medium text-gray-700 hover:border-teal-400 hover:text-teal-700 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 cursor-pointer transition-all duration-200"
                    >
                      {proc}
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 text-center">Autoimmune</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {CHRONIC_PAIN_CONDITIONS.map((cond) => (
                    <Link
                      key={cond}
                      href={`/watch?procedure=${encodeURIComponent(cond)}`}
                      className="bg-white border border-purple-200 rounded-full px-5 py-2.5 min-h-[44px] flex items-center text-sm font-medium text-gray-700 hover:border-purple-400 hover:text-purple-700 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 cursor-pointer transition-all duration-200"
                    >
                      {cond}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="text-center mt-8">
                <FeatureRequestButton
                  defaultType="condition"
                  variant="dashed"
                  label="Don't see your condition? Request it"
                />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Content Categories */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Structured Content</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Guides record guided entries across six categories, so you
                find exactly the information you need.
              </p>
            </div>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {RECORDING_CATEGORIES.map((cat, i) => (
              <ScrollReveal key={cat.value} delay={Math.min(i + 1, 3)}>
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-teal-100 cursor-default transition-all duration-300 group">
                  <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center mb-3 text-teal-600 group-hover:bg-teal-100 transition-colors duration-300">
                    {categoryIcons[cat.value] || <BookOpen className="w-5 h-5" />}
                  </div>
                  <h4 className="font-semibold mb-1">{cat.label}</h4>
                  <p className="text-sm text-gray-600">{cat.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialsSection />

      {/* CTA for Guides */}
      <section className="relative bg-gradient-to-br from-cyan-600 via-teal-700 to-teal-800 text-white py-20 overflow-hidden">
        {/* Pattern overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.05)_0%,_transparent_70%)]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Been through it? Help others navigate it.
            </h2>
            <p className="text-cyan-100/90 max-w-2xl mx-auto mb-8 leading-relaxed">
              Many guides say that sharing their story is one of the most meaningful
              parts of their recovery — almost therapeutic. Record free stories that build
              your audience, and earn money through live video calls. Whether you&apos;ve
              recovered from surgery or manage an autoimmune condition, someone out there
              needs to hear your story.
            </p>
            <GuideCTA />
          </ScrollReveal>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-400 leading-relaxed">
            Kizu provides peer-to-peer recovery experiences and is not a
            medical service. Content shared by guides reflects personal
            experience and should not be considered medical advice. Always consult
            your healthcare provider for medical decisions. By using this platform,
            you agree to our Terms of Service and understand that individual
            recovery experiences vary.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="mb-4">
                <Image
                  src="/images/logo_v2.png"
                  alt="Kizu"
                  width={64}
                  height={64}
                />
              </div>
              <p className="text-sm">
                Peer recovery guidance from people who have been through it.
              </p>
            </div>
            <FooterSeekerLinks />
            <div>
              <h4 className="text-white font-semibold mb-3">For Guides</h4>
              <FooterGuideLinks />
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white transition-colors duration-200">About</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors duration-200">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors duration-200">Terms of Service</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors duration-200">Contact</Link></li>
                <li>
                  <FeatureRequestButton
                    defaultType="feature"
                    variant="link"
                    label="Suggest a Feature"
                  />
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-sm text-center">
            &copy; {new Date().getFullYear()} Kizu. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
