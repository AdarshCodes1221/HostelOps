import React from 'react';
import { Heart } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center space-x-1 text-sm text-muted-foreground">
          <span>Made with</span>
          <Heart className="w-4 h-4 text-destructive fill-destructive" />
          <span>by Adarsh</span>
          <span>•</span>
          <span>© {currentYear}</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
