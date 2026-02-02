"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Shield,
  Zap,
  Users,
  Database,
  FileImage,
  Activity,
  ChevronRight,
} from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight text-foreground">
            EMEDX
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#solutions" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Solutions
            </Link>
            <Link href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/studies" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/studies">
              <Button className="rounded-full px-6">
                Open App <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm text-muted-foreground mb-8">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Now available for healthcare institutions
            </div>
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-foreground leading-tight text-balance">
              Medical Imaging
              <br />
              <span className="text-muted-foreground">Reimagined</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed text-pretty">
              A modern DICOM platform that streamlines medical imaging workflows.
              Secure, fast, and built for the future of healthcare.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/studies">
                <Button size="lg" className="rounded-full px-8 py-6 text-base">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="rounded-full px-8 py-6 text-base bg-transparent">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 border-y border-border bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "500K+", label: "Studies Processed" },
              { value: "99.9%", label: "Uptime" },
              { value: "150+", label: "Healthcare Partners" },
              { value: "<2s", label: "Average Load Time" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-semibold text-foreground">{stat.value}</div>
                <div className="mt-2 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-foreground text-balance">
              Everything you need for
              <br />
              modern medical imaging
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: FileImage,
                title: "DICOM Standards",
                description: "Full compliance with DICOM 3.0 standards for seamless integration with existing equipment.",
              },
              {
                icon: Shield,
                title: "Enterprise Security",
                description: "HIPAA compliant with end-to-end encryption and comprehensive audit logging.",
              },
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Optimized rendering engine for instant image loading and smooth navigation.",
              },
              {
                icon: Users,
                title: "Multi-user Support",
                description: "Role-based access control with support for multiple departments and teams.",
              },
              {
                icon: Database,
                title: "Unlimited Storage",
                description: "Scalable cloud infrastructure that grows with your institution.",
              },
              {
                icon: Activity,
                title: "Real-time Analytics",
                description: "Comprehensive dashboards for monitoring workflow and system performance.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-8 rounded-2xl bg-card border border-border hover:border-foreground/20 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section id="solutions" className="py-24 px-6 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold leading-tight text-balance">
                A comprehensive approach
                <br />
                for modern healthcare
              </h2>
              <p className="mt-6 text-primary-foreground/70 leading-relaxed text-pretty">
                EMEDX provides end-to-end solutions for medical imaging management,
                from acquisition to archival, designed to enhance diagnostic accuracy
                and improve patient outcomes.
              </p>
              <Button
                variant="secondary"
                className="mt-8 rounded-full px-6"
              >
                Our Commitment <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: "Radiology", desc: "Advanced imaging tools" },
                { title: "Cardiology", desc: "Cardiac analysis suite" },
                { title: "Orthopedics", desc: "3D reconstruction" },
                { title: "Oncology", desc: "Tumor tracking" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-6 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 hover:bg-primary-foreground/15 transition-colors"
                >
                  <h4 className="font-medium text-primary-foreground">{item.title}</h4>
                  <p className="mt-2 text-sm text-primary-foreground/70">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground text-balance">
            Ready to transform your
            <br />
            imaging workflow?
          </h2>
          <p className="mt-6 text-muted-foreground text-pretty">
            Join hundreds of healthcare institutions already using EMEDX
            to deliver better patient care.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/studies">
              <Button size="lg" className="rounded-full px-8 py-6 text-base">
                Start Free Trial
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="rounded-full px-8 py-6 text-base bg-transparent">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 border-t border-border bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold text-foreground mb-4">EMEDX</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Modern medical imaging platform for healthcare professionals.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Security</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Careers</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-foreground transition-colors">Privacy</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="#" className="hover:text-foreground transition-colors">HIPAA</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 EMEDX. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition-colors">LinkedIn</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Twitter</Link>
              <Link href="#" className="hover:text-foreground transition-colors">GitHub</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
