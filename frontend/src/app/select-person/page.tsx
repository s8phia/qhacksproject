"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
}

const PROFILES = [
  {
    name: "Warren Buffett",
    image: "/profile1.jpg",
    description: "Long-term value investor focused on strong fundamentals and durable businesses."
  },
  {
    name: "Cathie Wood",
    image: "/profile2.jpg",
    description: "High-risk, high-growth investor focused on disruptive innovation and technology."
  },
  {
    name: "Michael Burry",
    image: "/profile3.jpg",
    description: "Contrarian investor who looks for mispriced and distressed opportunities."
  }
];

export default function SelectPersonPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filteredProfiles = PROFILES.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-8 overflow-hidden bg-[#0c0810]">

      <div className="absolute inset-0 z-0 flex justify-center items-start">
        <div className="relative w-[900px] h-[600px] -translate-y-20 scale-110">
          <div className="absolute w-72 h-72 rounded-full bg-[#1e0237] blur-3xl opacity-40 top-20 left-5"></div>

          <div className="absolute w-96 h-96 rounded-full bg-[#561557] blur-3xl opacity-40 top-40 left-48"></div>

          <div className="absolute w-96 h-96 rounded-full bg-[#561557] blur-3xl opacity-40 top-40 left-160"></div>

          <div className="absolute w-72 h-72 rounded-full bg-[#561557] blur-3xl opacity-40 top-72 left-250"></div>

          <div className="absolute w-50 h-50 rounded-full bg-[#ffae51] blur-3xl opacity-10 top-24 left-200"></div>

          <div className="absolute w-20 h-20 rounded-full bg-[#c0207b] blur-2xl opacity-10 top-32 left-90"></div>

          <div className="absolute w-90 h-90 rounded-full bg-[#1e0237] blur-3xl opacity-60 top-48 left-200"></div>

          <div className="absolute w-20 h-20 rounded-full bg-[#ffae51] blur-3xl opacity-30 top-96 left-5"></div>

          <div className="absolute w-20 h-20 rounded-full bg-[#561557] blur-2xl opacity-60 top-64 left-100"></div>

          <div className="absolute w-80 h-80 rounded-full bg-[#c0207b] blur-3xl opacity-20 top-52 left-1/2 -translate-x-1/2"></div>
        </div>
      </div>


      {/* Back Button */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-8 right-8 px-6 py-3 bg-[#0c0810] text-white rounded-full cursor-pointer shadow-[0_0_20px_rgba(192,32,123,0.4)] hover:shadow-[0_0_30px_rgba(192,32,123,0.6)] hover:bg-[#1e0237] transition-all duration-300 ease-out hover:scale-105">
        Back
      </button>
      <div className="relative z-20 flex flex-col items-center justify-center">

        <h1 className="text-5xl font-fustat font-bold mb-4 drop-shadow-[0_0_15px_rgba(192,32,123,0.5)]">
          Select a person
        </h1>

        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="
  mb-10 px-4 py-2 border border-white text-[#c0207b]
      rounded-full w-[500px]"

        />

        {/* Profiles */}
        <div className="flex flex-row gap-16 mb-10">
          {filteredProfiles.map((profile) => (
            <div
              key={profile.name}
              onClick={() => router.push(`/profile/${slugify(profile.name)}`)}
              className="relative group flex flex-col items-center cursor-pointer
            hover:text-[#c0207b] transition-all duration-300 ease-out hover:scale-105"
            >
              <img
                src={profile.image}
                alt={profile.name}
                className="
                w-40 h-40 rounded-full object-cover mb-2
                hover:drop-shadow-[0_0_15px_rgba(192,32,123,0.2)]
              "
              />

              <span className="text-xl font-medium">
                {profile.name}
              </span>

              {/* Hover description */}
              <div
                className="
                pointer-events-none
                absolute
                -bottom-20
                w-64 
                opacity-0
                translate-y-0
                group-hover:opacity-100
                group-hover:translate-y-4
                transition-all
                duration-300
                ease-out
                text-white
                text-sm
                rounded-lg
                p-3
                text-center "
              >
                {profile.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main >
  );
}