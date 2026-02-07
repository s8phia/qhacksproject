"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

  const filteredProfiles = PROFILES.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 relative">
      {/* Back Button */}
      <button
        className="absolute top-8 right-8 px-6 py-3 bg-black text-white rounded-lg"
        onClick={() => router.push("/")}
      >
        Back
      </button>

      <h1 className="text-5xl font-bold mb-8">Select a person</h1>

      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-10 px-4 py-2 border border-gray-300 rounded-lg w-[500px] focus:outline-none focus:ring-2 focus:ring-black"
      />

      {/* Profiles */}
      <div className="flex flex-row gap-16 mb-10">
        {filteredProfiles.map((profile) => (
          <div
            key={profile.name}
            className="relative group flex flex-col items-center"
          >
            <img
              src={profile.image}
              alt={profile.name}
              className="w-40 h-40 rounded-full object-cover border-2 border-black mb-2"
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
                group-hover:opacity-100
                transition
                bg-black
                text-white
                text-sm
                rounded-lg
                p-3
                text-center
              "
            >
              {profile.description}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}