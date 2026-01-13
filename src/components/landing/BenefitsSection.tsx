import { motion } from "framer-motion";
import { CheckCircle, Heart, Smile } from "lucide-react";

const benefits = [
  {
    icon: CheckCircle,
    title: "Easy - Setup is simple",
    description: "Once set-up, Pillaxia works in the background, with Angela providing personalised notifications.",
  },
  {
    icon: Heart,
    title: "Caring Style",
    description: "Angela is your care companion, providing gentle reminders and answering health queries",
  },
  {
    icon: Smile,
    title: "Feel your best",
    description: "Pillaxia's PxTracker and PxDiary helps your medical team fine tune your regiment for optimal health.",
  },
];

const BenefitsSection = () => {
  return (
    <section id="about" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-foreground">The Future of </span>
            <span className="text-pillaxia-cyan">Medication Management</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Empowering your health journey with every reminder
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-card p-8 rounded-xl shadow-lg border border-border text-center"
            >
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-pillaxia-cyan/10 rounded-full flex items-center justify-center">
                  <benefit.icon className="w-10 h-10 text-pillaxia-cyan" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">{benefit.title}</h3>
              <p className="text-muted-foreground">{benefit.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
