import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, FileText, Users, Sparkles, ArrowRight, Star, Zap, Shield, Globe } from "lucide-react";

const bookCovers = [
  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=420&fit=crop",
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&h=420&fit=crop",
  "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300&h=420&fit=crop",
  "https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=300&h=420&fit=crop",
];

const features = [
  {
    icon: BookOpen,
    title: "Rich Text Editor",
    desc: "A distraction-free writing experience built specifically for authors and storytellers.",
  },
  {
    icon: FileText,
    title: "One-Click Export",
    desc: "Export your manuscript to PDF, EPUB, or MOBI in seconds with professional formatting.",
  },
  {
    icon: Users,
    title: "Real-Time Collaboration",
    desc: "Invite editors and co-authors to work on your book together, simultaneously.",
  },
  {
    icon: Shield,
    title: "Version History",
    desc: "Every change is tracked. Restore any previous version of your manuscript instantly.",
  },
  {
    icon: Zap,
    title: "Auto-Save",
    desc: "Never lose a word. Your work is saved continuously as you write.",
  },
  {
    icon: Globe,
    title: "Publish Anywhere",
    desc: "Generate files ready for Amazon KDP, Apple Books, and every major platform.",
  },
];

const testimonials = [
  {
    quote: "Folio AI cut my publishing workflow in half. The export quality is incredible.",
    name: "Maria Chen",
    title: "Bestselling Author",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face",
  },
  {
    quote: "I switched from Scrivener and never looked back. The collaboration tools are unmatched.",
    name: "David Park",
    title: "Indie Publisher",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
  },
  {
    quote: "The cleanest writing interface I've ever used. It just gets out of your way.",
    name: "Lena Rossi",
    title: "Content Writer",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face",
  },
];

const stats = [
  { value: "12,000+", label: "Authors" },
  { value: "45,000+", label: "Books Created" },
  { value: "2M+", label: "Chapters Written" },
  { value: "99.9%", label: "Uptime" },
];

const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Folio AI
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:scale-[1.02] btn-press"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-28 md:pt-28 md:pb-36">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
                <Sparkles className="w-3 h-3" /> Now with AI-assisted writing
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-[1.1] mb-6">
                Write. Publish.{" "}
                <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                  Inspire.
                </span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                The all-in-one platform for authors. Write your manuscript, collaborate with your team, 
                and export to every major format — all from one beautiful workspace.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:scale-[1.02] btn-press"
                >
                  Start Writing for Free <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-border bg-card text-foreground font-medium hover:bg-muted transition-colors"
                >
                  View Demo
                </Link>
              </div>
              <p className="text-xs text-muted-foreground mt-4">Free forever · No credit card required</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="relative flex justify-center">
                {bookCovers.map((cover, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-2xl overflow-hidden shadow-2xl"
                    style={{
                      width: 160,
                      height: 220,
                      left: `${i * 60 + 20}px`,
                      top: `${Math.abs(i - 1.5) * 20}px`,
                      zIndex: i === 1 || i === 2 ? 2 : 1,
                      transform: `rotate(${(i - 1.5) * 4}deg)`,
                    }}
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <img src={cover} alt="" className="w-full h-full object-cover" />
                  </motion.div>
                ))}
              </div>
              {/* Glow */}
              <div className="absolute -top-10 right-10 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute bottom-0 left-10 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl" />
            </motion.div>
          </div>
        </div>

        {/* Background gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[500px] bg-gradient-to-b from-primary/5 via-transparent to-transparent -z-10 rounded-full blur-3xl" />
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fade}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-extrabold text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need to write & publish
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From first draft to published book, Folio AI gives you every tool in one workspace.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fade}
                className="folio-card p-6 hover-lift group"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Editor Preview */}
      <section className="py-24 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              A writing experience you'll love
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Clean, focused, and powerful. Our editor stays out of your way while giving you everything you need.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-2xl overflow-hidden shadow-2xl border border-border"
          >
            <div className="bg-muted/50 h-10 flex items-center gap-2 px-4 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-warning/60" />
                <div className="w-3 h-3 rounded-full bg-success/60" />
              </div>
              <span className="text-xs text-muted-foreground ml-2">Folio AI Editor — The Last Algorithm</span>
            </div>
            <div className="bg-card p-8 md:p-12">
              <div className="max-w-2xl mx-auto">
                <h3 className="text-2xl font-bold text-foreground mb-4">Chapter 1 — The Beginning</h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  The terminal blinked twice before the message appeared. Dr. Elena Vasquez leaned closer 
                  to the screen, her coffee growing cold beside her keyboard. The algorithm had been running 
                  for seventy-two hours straight...
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  "That's not possible," she whispered, scrolling through the output. The numbers didn't just 
                  suggest a breakthrough — they demanded one.
                </p>
                <div className="mt-4 h-5 w-0.5 bg-primary animate-pulse" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Loved by authors worldwide
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fade}
                className="folio-card p-6"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-warning fill-warning" />
                  ))}
                </div>
                <p className="text-foreground leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.title}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground">Start free. Upgrade when you're ready.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: "Free",
                price: "$0",
                desc: "For getting started",
                features: ["3 books", "Basic editor", "PDF export", "5 MB storage"],
                cta: "Get Started",
                highlighted: false,
              },
              {
                name: "Pro",
                price: "$12",
                desc: "For serious authors",
                features: ["Unlimited books", "Advanced editor", "PDF, EPUB, MOBI", "50 GB storage", "Collaboration", "Version history"],
                cta: "Start Free Trial",
                highlighted: true,
              },
              {
                name: "Team",
                price: "$29",
                desc: "For publishing teams",
                features: ["Everything in Pro", "Unlimited members", "Admin dashboard", "Priority support", "Custom branding"],
                cta: "Contact Sales",
                highlighted: false,
              },
            ].map((plan, i) => (
              <motion.div
                key={plan.name}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fade}
                className={`rounded-2xl p-6 border ${
                  plan.highlighted
                    ? "border-primary bg-primary/[0.03] shadow-lg shadow-primary/10 relative"
                    : "border-border bg-card"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className="font-bold text-foreground text-lg">{plan.name}</h3>
                <div className="mt-2 mb-1">
                  <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                  {plan.price !== "$0" && <span className="text-muted-foreground text-sm">/month</span>}
                </div>
                <p className="text-sm text-muted-foreground mb-6">{plan.desc}</p>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                        <svg className="w-3 h-3 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`block w-full py-2.5 rounded-xl text-center text-sm font-medium btn-press ${
                    plan.highlighted
                      ? "bg-primary text-primary-foreground shadow-sm hover:scale-[1.02]"
                      : "border border-border text-foreground hover:bg-muted transition-colors"
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to write your next book?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Join thousands of authors who trust Folio AI to bring their stories to life.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:scale-[1.02] btn-press text-lg"
            >
              Get Started for Free <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-lg font-bold text-primary">
              <Sparkles className="w-4 h-4" /> Folio AI
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 Folio AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
