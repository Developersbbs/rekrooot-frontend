import Image from "next/image";
import Snowfall from "../components/Snowfall";

export default function Home() {
  return (
    <div
      style={{
        backgroundImage: `url('https://firebasestorage.googleapis.com/v0/b/x-talento-new.appspot.com/o/assets%2Fsnowbg.webp?alt=media&token=1b3474b8-c42e-4792-a803-594d6d3ad954')`, // Add your background image path
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: 'cover'
      }}
      className="w-full h-screen"
    >
      <Snowfall />

    </div>
  );
}
