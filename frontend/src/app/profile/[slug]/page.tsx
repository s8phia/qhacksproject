"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type ProfileData = {
    name: string;
    avatarUrl?: string;
    bio?: string;
    tradingStyle?: string;
    riskProfile?: string;
    stats?: Record<string, string | number>;
};

function getPersonaImage(slug: string) {
    const map: Record<string, string> = {
        "warren-buffett": "/profile1.jpg",
        "cathie-wood": "/profile2.jpg",
        "michael-burry": "/profile3.jpg",
    };

    return map[slug] ?? "/profile1.jpg";
}


export default function ProfilePage() {
    const params = useParams();
    const slug = params.slug as string;

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProfile() {
        setLoading(true);

        /*
            This is intentionally not hard-coded to a person.
            Later this will be replaced with:
            fetch(`/api/profile/${slug}`)
        */

        setProfile({
            name: slug.replace(/-/g, " "),
        });

        setLoading(false);
        }

        if (slug) {
        loadProfile();
        }
    }, [slug]);

    if (loading) {
        return (
        <main className="min-h-screen p-10">
            Loading profile...
        </main>
        );
    }

    if (!profile) {
        return (
        <main className="min-h-screen p-10">
            Profile not found.
        </main>
        );
    }

    return (
        <main className="min-h-screen p-10 max-w-7xl mx-auto">

            {/* Header */}
            <section className="flex items-center gap-6 mb-12">
            <img
                src={getPersonaImage(slug)}
                alt={profile.name}
                className="w-32 h-32 rounded-full object-cover border"
            />

            <div>
                <h1 className="text-4xl font-bold capitalize">
                {profile.name}
                </h1>
                <p className="text-gray-600">
                {profile.tradingStyle ?? "Trading style coming soon"}
                </p>
            </div>
            </section>

            {/* ================= Comparison ================= */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-10">

            {/* ---------------- Your data ---------------- */}
            <div className="border rounded-xl p-6">
                <h2 className="text-2xl font-semibold mb-6">
                Your profile
                </h2>

                {/* Summary */}
                <div className="mb-8">
                <h3 className="text-lg font-semibold mb-2">
                    Summary
                </h3>
                <ul className="list-disc pl-5 text-gray-700 space-y-1">
                    <li>Short summary about your trading behaviour</li>
                    <li>Strengths and weaknesses placeholder</li>
                    <li>Typical decisions and patterns placeholder</li>
                </ul>
                </div>

                {/* Charts */}
                <div className="mb-8">
                <h3 className="text-lg font-semibold mb-2">
                    Performance & behaviour
                </h3>

                <div className="h-48 border border-dashed rounded-lg flex items-center justify-center text-gray-400">
                    User charts will be rendered here
                </div>
                </div>

                {/* Radar */}
                <div>
                <h3 className="text-lg font-semibold mb-2">
                    Risk & style radar
                </h3>

                <div className="h-48 border border-dashed rounded-lg flex items-center justify-center text-gray-400">
                    User radar chart placeholder
                </div>
                </div>
            </div>

            {/* ---------------- Persona data ---------------- */}
            <div className="border rounded-xl p-6">
                <h2 className="text-2xl font-semibold mb-6">
                Persona profile
                </h2>

                {/* Summary */}
                <div className="mb-8">
                <h3 className="text-lg font-semibold mb-2">
                    Summary
                </h3>
                <ul className="list-disc pl-5 text-gray-700 space-y-1">
                    <li>Persona behavioural summary placeholder</li>
                    <li>Typical strategy and signals placeholder</li>
                    <li>Risk posture and style placeholder</li>
                </ul>
                </div>

                {/* Charts */}
                <div className="mb-8">
                <h3 className="text-lg font-semibold mb-2">
                    Performance & behaviour
                </h3>

                <div className="h-48 border border-dashed rounded-lg flex items-center justify-center text-gray-400">
                    Persona charts will be rendered here
                </div>
                </div>

                {/* Radar */}
                <div>
                <h3 className="text-lg font-semibold mb-2">
                    Risk & style radar
                </h3>

                <div className="h-48 border border-dashed rounded-lg flex items-center justify-center text-gray-400">
                    Persona radar chart placeholder
                </div>
                </div>
            </div>

            </section>

            {/* ================= Explanation ================= */}
            <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-3">
                How you compare to this persona
            </h2>

            <div className="border rounded-lg p-6 text-gray-600">
                Alignment explanation and similarity scoring will appear here.
            </div>
            </section>
        </main>
    );
}
