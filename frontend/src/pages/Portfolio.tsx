import { Projects } from "@/components/Projects";
import { Skills } from "@/components/Skills";

export default function Portfolio() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold text-center mb-10">My Portfolio</h1>
      <Projects />
      <Skills />
    </div>
  );
}