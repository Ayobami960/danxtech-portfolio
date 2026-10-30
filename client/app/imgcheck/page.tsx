import ProjectImage from "@/components/ui/ProjectImage";

export default function ImageCheck() {
  return (
    <main>
      <ProjectImage
        src="https://res.cloudinary.com/dls0snoaa/image/upload/portfolio/projects/covers/does-not-exist"
        alt="broken cover"
        icon="🏛️"
        className="aspect-video w-full object-cover"
      />
    </main>
  );
}
