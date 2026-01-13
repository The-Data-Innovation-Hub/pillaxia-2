const Footer = () => {
  return (
    <footer id="contact" className="bg-pillaxia-navy-dark text-primary-foreground py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h4 className="font-bold text-lg mb-4">Your Partner in Health</h4>
            <p className="text-primary-foreground/70">
              Empowering Your Health Journey with Every Reminder.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Useful Links</h4>
            <ul className="space-y-2 text-primary-foreground/70">
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Home</a></li>
              <li><a href="#about" className="hover:text-primary-foreground transition-colors">About Us</a></li>
              <li><a href="#contact" className="hover:text-primary-foreground transition-colors">Contact Us</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-primary-foreground/70">
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Support & FAQs</a></li>
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Terms & conditions</a></li>
              <li><a href="#" className="hover:text-primary-foreground transition-colors">Privacy policy</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Connect</h4>
            <p className="text-primary-foreground/70">
              <a href="mailto:connect@pillaxia.com" className="hover:text-primary-foreground transition-colors">
                connect@pillaxia.com
              </a>
            </p>
          </div>
        </div>
        <div className="border-t border-primary-foreground/20 pt-8 text-center text-primary-foreground/70">
          <p>Copyright © {new Date().getFullYear()} Pillaxia. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
