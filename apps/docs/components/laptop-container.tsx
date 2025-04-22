import LaptopAnimation from "@/components/laptop-animation";

export default function LaptopContainer() {
  return (
    <div className="relative h-[400px] sm:h-[600px]" id="laptop-container">
      <div className="w-full relative" style={{ perspective: "1000px" }}>
        <LaptopAnimation />
      </div>
    </div>
  );
}
