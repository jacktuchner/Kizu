"use client";

import { Quote } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

const testimonials = [
  {
    quote:
      "After my ACL surgery, I was terrified about recovery. My guide had the same surgery at the same age and told me exactly what to expect week by week. It made all the difference.",
    name: "Sarah M.",
    condition: "ACL Reconstruction",
  },
  {
    quote:
      "My doctor gave me the medical facts, but my Kizu guide gave me the real story. She told me which week was the hardest, what to meal prep, and how to sleep comfortably. Priceless.",
    name: "James R.",
    condition: "Total Hip Replacement",
  },
  {
    quote:
      "Being diagnosed with fibromyalgia was isolating. Connecting with someone who actually lives with it and thrives gave me hope I couldn't get anywhere else.",
    name: "Maria L.",
    condition: "Fibromyalgia",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              What Seekers Are Saying
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Real experiences from people who found guidance on Kizu.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <ScrollReveal key={t.name} delay={i + 1}>
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm hover:shadow-lg transition-all duration-300 h-full flex flex-col">
                <Quote className="w-8 h-8 text-teal-200 mb-4 flex-shrink-0" />
                <p className="text-gray-700 leading-relaxed mb-6 flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="border-t border-gray-100 pt-4">
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-sm text-teal-600">{t.condition}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
