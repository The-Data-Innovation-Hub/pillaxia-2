import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface MembershipSectionProps {
  onJoinWaitlist?: () => void;
}

const steps = [
  {
    number: 1,
    title: "Subscribe",
    description: "Join our newsletter and get an invitation to become a Founding Member.",
  },
  {
    number: 2,
    title: "Download Test App",
    description: "Click on the link in your email and download to test the app.",
  },
  {
    number: 3,
    title: "Start Journey",
    description: "Enter your medications. Get reminders. Start tracking.",
  },
];

const MembershipSection = ({ onJoinWaitlist }: MembershipSectionProps) => {
  return (
    <section className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Become a Member
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            We're currently recruiting for Founding Members, help us launch our App. Get free access while identifying any glitches that we can fix before we officially open to the public. Join as a Founding Member on launch and enjoy exclusive early access benefits
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-card p-8 rounded-xl shadow-lg text-center"
            >
              <div className="w-16 h-16 bg-pillaxia-cyan rounded-full flex items-center justify-center text-primary-foreground text-2xl font-bold mx-auto mb-4">
                {step.number}
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button
            size="lg"
            className="bg-primary hover:bg-pillaxia-navy-dark text-primary-foreground text-xl py-6 px-8 rounded-xl shadow-lg"
            onClick={onJoinWaitlist}
          >
            Join our Waiting List
          </Button>
        </div>
      </div>
    </section>
  );
};

export default MembershipSection;
