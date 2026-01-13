import { motion } from "framer-motion";
import { Activity, Bot, BookOpen, Pill } from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "PX Tracker",
    description: "Track your adherence through detailed logs of your medication intake to help monitor effectiveness of treatments",
  },
  {
    icon: Bot,
    title: "AI Companion",
    description: "Angela, your AI-powered assistant, offers timely reminders and effortless interaction to simplify your regiment.",
  },
  {
    icon: BookOpen,
    title: "PX Diary",
    description: "Log and track symptoms and side effects, providing valuable insights for personalised treatment and proactive health management.",
  },
  {
    icon: Pill,
    title: "Medications",
    description: "Host multiple medications to simplify your medication management with all your medications in one place.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Track Pills, Symptoms & Schedules with Ease
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Let Angela handle your medication scheduling
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-card p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-pillaxia-cyan/10 rounded-lg flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-pillaxia-cyan" />
                </div>
                <h3 className="text-2xl font-bold text-pillaxia-cyan">{feature.title}</h3>
              </div>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
