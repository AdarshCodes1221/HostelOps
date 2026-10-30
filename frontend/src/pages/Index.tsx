import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Utensils,
  Bus,
  Users,
  Shield,
  Clock,
  Star,
  ArrowRight,
  Building,
  Phone,
  Mail,
  Bell,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import heroImage from '@/assets/hero-banner.jpg';
import gymImage from '@/assets/hostel-life/gym.jpg';
import messImage from '@/assets/hostel-life/mess.jpg';
import activitiesImage from '@/assets/hostel-life/activities.jpg';
import studyImage from '@/assets/hostel-life/study.jpg';
import hostelsBg from '@/assets/our-hostels-bg.jpeg';
import { useAuth } from '@/contexts/AuthContext';

interface RoomType {
  type: string;
  description: string;
}

interface HostelInfo {
  name: string;
  floors: number;
  capacity: string;
  amenities: string[];
  extraAmenities: string[];
  description: string;
  roomTypes: RoomType[];
}

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const [selectedHostel, setSelectedHostel] = useState<HostelInfo | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  // Define all data structures first
  const features = [
    {
      icon: FileText,
      title: 'Complaint System',
      description: 'Submit and track your grievances efficiently.',
      link: '/complaints'
    },
    {
      icon: Utensils,
      title: 'Mess Menu',
      description: 'View weekly meal schedules.',
      link: '/mess-menu'
    },
    {
      icon: Bus,
      title: 'Bus Routes',
      description: 'Access bus schedules and routes.',
      link: '/bus-routes'
    },
    {
      icon: Bell,
      title: 'Notice Board',
      description: 'Stay updated with latest announcements.',
      link: '/notice-board'
    },
    {
      icon: Users,
      title: 'Profile Management',
      description: 'Manage your hostel profile.',
      link: '/profile'
    }
  ];

  const stats = [
    { label: 'Active Students', value: '2,500+', icon: Users },
    { label: 'Complaints Resolved', value: '98%', icon: Shield },
    { label: 'Avg Response Time', value: '< 24hrs', icon: Clock },
    { label: 'Satisfaction', value: '4.8/5', icon: Star }
  ];

  const hostels = [
    {
      name: 'Voila Hostel',
      floors: 9,
      capacity: '1,200 students',
      amenities: ['WiFi', 'Laundry', 'Security', 'Mess'],
      extraAmenities: ['Study Hall', 'Common Room'],
      description: 'Perfect for students seeking a quiet and focused environment with excellent study facilities.',
      roomTypes: [
        { type: 'Single', description: 'Private room with attached bathroom' },
        { type: 'Double', description: 'Shared room with study area' }
      ]
    },
    {
      name: 'Magnolia Hostel',
      floors: 9,
      capacity: '1,300 students',
      amenities: ['WiFi', 'Laundry', 'Security', 'Mess'],
      extraAmenities: ['Gym', 'Sports Facilities', 'Recreation Room'],
      description: 'Ideal for active students who value fitness and recreation alongside their academics.',
      roomTypes: [
        { type: 'Single', description: 'Spacious room with modern amenities' },
        { type: 'Double', description: 'Comfortable shared accommodation' }
      ]
    }
  ];

  const hostelLifeSlides = [
    { type: 'image', content: gymImage, title: 'Gym & Fitness' },
    { type: 'image', content: messImage, title: 'Dining Hall' },
    { type: 'image', content: activitiesImage, title: 'Activities' },
    { type: 'image', content: studyImage, title: 'Study Area' },
    { type: 'video', content: 'https://www.youtube.com/embed/6IpGIBGhn3c', title: 'Student Life' },
    { type: 'image', content: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&h=800&fit=crop', title: 'Recreation Room' },
    { type: 'image', content: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=800&fit=crop', title: 'Common Area' },
    { type: 'image', content: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&h=800&fit=crop', title: 'Sports Facilities' },
    { type: 'video', content: 'https://www.youtube.com/embed/hQl82O1E79U', title: 'Campus Highlights' },
  ];

  // Auto-rotate carousel every 10 seconds (paused when user interacts)
  useEffect(() => {
    // Only auto-play if user is not interacting
    if (isUserInteracting) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % hostelLifeSlides.length);
    }, 10000); // 10 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, [hostelLifeSlides.length, isUserInteracting]);

  // Handler functions
  const handleGetStarted = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (isAdmin) {
      navigate('/admin/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const handleLearnMore = () => {
    window.location.href = 'mailto:hostel@sitpune.edu.in?subject=Hostel%20Management%20System%20Enquiry';
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % hostelLifeSlides.length);
    // Resume auto-play after manual navigation
    setIsUserInteracting(false);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + hostelLifeSlides.length) % hostelLifeSlides.length);
    // Resume auto-play after manual navigation
    setIsUserInteracting(false);
  };

  // Handle direct slide selection (clicking on dots or cards)
  const handleSlideClick = (index: number) => {
    setCurrentSlide(index);
    // Pause auto-play when user directly clicks on a slide
    setIsUserInteracting(true);
  };

  // Early return for loading state - AFTER all hooks are called
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-primary rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navigation />

      {/* Premium Hero Section */}
      <section className="relative overflow-hidden isolate">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center md:bg-fixed transform-gpu scale-105 will-change-transform transition-transform duration-1000"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/65 via-black/45 to-primary/30 mix-blend-multiply" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 120% at 50% 50%, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.75) 100%)' }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(59,130,246,0.18),transparent_38%),radial-gradient(circle_at_80%_15%,rgba(255,255,255,0.14),transparent_32%),radial-gradient(circle_at_50%_80%,rgba(0,0,0,0.35),transparent_40%)]" />
          <div className="absolute inset-0 backdrop-blur-[1.2px]" />
          {/* Animated gradient orbs background */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/18 rounded-full blur-3xl -mr-48 -mt-48 animate-pulse" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/12 rounded-full blur-3xl -ml-48 -mb-48 animate-pulse delay-1000" />
        </div>

        <div className="relative container mx-auto px-4 py-28 md:py-36 lg:py-40 min-h-[80vh] flex items-center justify-center text-center text-white">
          <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-slide">
            <div className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg shadow-black/20">
              <p className="text-sm md:text-base font-semibold tracking-[0.08em] text-white/85">Premium Hostel Management</p>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-balance drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)]">
              Symbiosis Hostel
              <span className="block bg-gradient-to-r from-white via-white/85 to-white/60 bg-clip-text text-transparent">Management System</span>
            </h1>
            
            <p className="text-lg md:text-xl lg:text-2xl text-white/90 leading-relaxed max-w-3xl mx-auto tracking-[0.01em]">
              One unified platform for complaints, mess menus, bus routes and hostel life
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2 sm:pt-4">
              <Button 
                size="lg" 
                onClick={handleGetStarted}
                className="gradient-primary text-white hover:shadow-lg hover:shadow-primary/50 transition-all duration-300 px-7 py-3 text-base font-semibold tracking-[0.01em]"
              >
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={handleLearnMore}
                className="px-7 py-3 text-base font-semibold tracking-[0.01em] border-white/55 bg-white/12 text-white hover:bg-white/18 hover:border-white/70 focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30 hover:shadow-lg hover:shadow-black/25"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Features Section */}
      <section className="py-24 container mx-auto px-4 relative">
        <div className="max-w-4xl mx-auto mb-16 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Powerful Features for Every Need
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to manage hostel life seamlessly
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/20"
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <div className="mb-4 inline-block p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    {feature.description}
                  </p>
                  
                  <Button 
                    variant="ghost" 
                    asChild 
                    className="text-primary hover:text-primary hover:bg-primary/10 group/btn"
                  >
                    <Link to={feature.link} className="flex items-center gap-2">
                      Explore
                      <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Premium Stats Section */}
      <section className="py-20 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/5" style={{ backgroundImage: "url('data:image/svg+xml?utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"50\" height=\"50\"><rect fill=\"none\" stroke=\"white\" stroke-opacity=\"0.05\" width=\"50\" height=\"50\"/></svg>')" }} />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={i}
                  className="group text-center p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300"
                >
                  <Icon className="mx-auto h-10 w-10 text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Premium Hostels Section */}
      <section id="our-hostels-section" className="relative py-24">
        {/* Background layer */}
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center md:bg-fixed"
          style={{ backgroundImage: `url(${hostelsBg})` }}
          aria-hidden="true"
        />

        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto mb-16 text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white px-8 py-4 bg-black/70 rounded-2xl inline-block backdrop-blur-sm">
              Our Hostels
            </h2>
            <p className="text-lg text-white font-semibold px-6 py-3 bg-black/60 rounded-xl inline-block backdrop-blur-sm mt-3">
              Modern facilities designed for student comfort
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {hostels.map((hostel, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setSelectedHostel(hostel)}
                className="w-full text-left group relative overflow-hidden rounded-3xl p-8 bg-black/75 backdrop-blur-md border border-white/40 hover:border-primary/70 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/30 cursor-pointer"
              >
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 rounded-xl bg-primary/50 group-hover:bg-primary/70 transition-colors">
                      <Building className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-white">{hostel.name}</h3>
                      <p className="text-sm text-white/90 mt-1 font-medium">
                        {hostel.floors} floors • {hostel.capacity}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-white/90 mb-2 font-bold">Base Facilities</p>
                      <div className="flex flex-wrap gap-2">
                        {hostel.amenities.map((a, j) => (
                          <Badge 
                            key={j} 
                            variant="outline"
                            className="bg-white/20 border-white/50 text-white hover:bg-white/30 transition-colors font-medium"
                          >
                            {a}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {hostel.extraAmenities && hostel.extraAmenities.length > 0 && (
                      <div>
                        <p className="text-xs text-white/90 mb-2 font-bold">Extra Amenities</p>
                        <div className="flex flex-wrap gap-2">
                          {hostel.extraAmenities.map((a, j) => (
                            <Badge 
                              key={j} 
                              variant="outline"
                              className="bg-white/20 border-white/50 text-white hover:bg-white/30 transition-colors font-medium"
                            >
                              {a}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-white/95 mt-4 group-hover:text-white transition-colors font-medium">
                    Click to view details →
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Life at Our Hostels Carousel Section */}
      <section className="py-24 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/5" style={{ backgroundImage: "url('data:image/svg+xml?utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"50\" height=\"50\"><rect fill=\"none\" stroke=\"white\" stroke-opacity=\"0.05\" width=\"50\" height=\"50\"/></svg>')" }} />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto mb-16 text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Life at Our Hostels
            </h2>
            <p className="text-lg text-muted-foreground">
              Experience a vibrant community with world-class facilities
            </p>
          </div>

          <div className="max-w-4xl mx-auto relative">
            <div className="relative overflow-hidden rounded-3xl shadow-elevated">
              <div className="relative min-h-[400px] md:min-h-[500px]">
                {hostelLifeSlides.map((slide, idx) => {
                  return (
                    <div
                      key={idx}
                      className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                        idx === currentSlide ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 z-0'
                      }`}
                    >
                      <div className="relative w-full h-full overflow-hidden rounded-3xl group cursor-pointer shadow-2xl bg-black">
                        {/* Image Slide */}
                        {slide.type === 'image' && (
                          <>
                            <img
                              src={slide.content}
                              alt={slide.title}
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            {/* Animated gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            {/* Subtle top glow */}
                            <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent" />
                            {/* Title overlay */}
                            <div className="absolute bottom-6 left-6 right-6 text-white">
                              <h3 className="text-xl font-bold drop-shadow-lg">{slide.title}</h3>
                            </div>
                          </>
                        )}

                        {/* Video Slide */}
                        {slide.type === 'video' && (
                          <>
                            <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
                              <iframe
                                width="100%"
                                height="100%"
                                src={slide.content + '?autoplay=0&rel=0'}
                                title={slide.title}
                                frameBorder="0"
                                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full transition-all duration-1000 ease-in-out"
                                style={{ aspectRatio: '16/9' }}
                              ></iframe>
                            </div>
                            {/* Title overlay for video */}
                            <div className="absolute bottom-6 left-6 right-6 text-white bg-black/70 p-3 rounded-lg backdrop-blur-sm">
                              <h3 className="text-xl font-bold drop-shadow-lg">{slide.title}</h3>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <Button
                variant="outline"
                size="icon"
                onClick={prevSlide}
                className="rounded-full bg-white/10 border-white/20 hover:bg-primary/40 hover:border-primary/60 transition-all duration-300 hover:scale-110"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <div className="flex gap-2">
                {hostelLifeSlides.map((_, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => handleSlideClick(idx)}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === currentSlide
                        ? 'w-8 bg-primary shadow-lg shadow-primary/50'
                        : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60 hover:scale-125'
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={nextSlide}
                className="rounded-full bg-white/10 border-white/20 hover:bg-primary/40 hover:border-primary/60 transition-all duration-300 hover:scale-110"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Contact Section */}
      <section className="py-24 bg-gradient-to-t from-primary/5 via-transparent to-transparent relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto mb-16 text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Get in Touch
            </h2>
            <p className="text-lg text-muted-foreground">
              We're here to help and answer any questions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group text-center p-8 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300">
              <div className="inline-block p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors mb-4">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <p className="font-semibold mb-2">Call Us</p>
              <p className="text-muted-foreground">+91 20 2818 1000</p>
            </div>

            <div className="group text-center p-8 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300">
              <div className="inline-block p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors mb-4">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <p className="font-semibold mb-2">Email Us</p>
              <p className="text-muted-foreground">hostel@sitpune.edu.in</p>
            </div>

            <div className="group text-center p-8 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300">
              <div className="inline-block p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <p className="font-semibold mb-2">File Complaint</p>
              <Button 
                asChild 
                variant="ghost"
                className="text-primary hover:text-primary hover:bg-primary/10 mt-2"
              >
                <Link to="/complaints">Submit Now</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Hostel Detail Modal */}
      <Dialog open={!!selectedHostel} onOpenChange={() => setSelectedHostel(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedHostel && (
            <>
              <DialogHeader>
                <DialogTitle className="text-3xl font-bold">
                  {selectedHostel.name}
                </DialogTitle>
                <DialogDescription className="text-base">
                  {selectedHostel.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Hostel Info */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm text-muted-foreground">Floors</p>
                    <p className="text-lg font-semibold">{selectedHostel.floors}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Capacity</p>
                    <p className="text-lg font-semibold">{selectedHostel.capacity}</p>
                  </div>
                </div>

                {/* Room Types */}
                <div>
                  <h3 className="text-xl font-bold mb-3">Room Types</h3>
                  <div className="space-y-3">
                    {selectedHostel.roomTypes.map((room: RoomType, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
                      >
                        <h4 className="font-semibold text-lg mb-1">{room.type} Room</h4>
                        <p className="text-sm text-muted-foreground">{room.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Facilities */}
                <div>
                  <h3 className="text-xl font-bold mb-3">Base Facilities</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedHostel.amenities.map((amenity: string, idx: number) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="bg-primary/10 border-primary/30 text-primary"
                      >
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Extra Amenities */}
                {selectedHostel.extraAmenities && selectedHostel.extraAmenities.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold mb-3">Extra Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedHostel.extraAmenities.map((amenity: string, idx: number) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="bg-secondary/10 border-secondary/30 text-secondary"
                        >
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Call to Action */}
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-3">
                    Interested in learning more? Get in touch with us!
                  </p>
                  <Button
                    onClick={() => {
                      setSelectedHostel(null);
                      window.location.href = 'mailto:hostel@sitpune.edu.in?subject=Hostel%20Enquiry%20-%20' + selectedHostel.name;
                    }}
                    className="w-full gradient-primary"
                  >
                    Contact Us
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Index;
