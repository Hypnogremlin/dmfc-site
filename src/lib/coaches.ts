export type Session = "foil-youth" | "foil-adult" | "epee" | "saber";

export type Coach = {
  name: string;
  role: string;
  image?: string;
  bio?: string;
  sessions: Session[];
};

// Ordered as they appear on the archived about_coaches.html page.
export const coaches: Coach[] = [
  { name: "Jon Greising", role: "Foil & Épée", image: "/coaches/jon.jpg", sessions: ["foil-adult", "epee"] },
  { name: "Preston Kirkpatrick", role: "Saber", image: "/coaches/preston.jpg", sessions: ["saber"] },
  { name: "Josiah Janecek", role: "Foil", image: "/coaches/josiah.jpg", sessions: ["foil-adult"] },
  { name: "Emilia Reis", role: "Saber", image: "/coaches/emilia.jpg", sessions: ["saber"] },
  { name: "Abbey Freed", role: "Foil", image: "/coaches/abbey.jpg", sessions: ["foil-youth", "foil-adult"] },
  { name: "Taryn Young", role: "Foil", sessions: ["foil-youth"] },
  { name: "Trevor Carra", role: "Saber", sessions: ["saber"] },
  { name: "Levi Miller", role: "Saber", sessions: ["saber"] },
];

export function getCoachesForSession(session: Session): Coach[] {
  return coaches.filter((coach) => coach.sessions.includes(session));
}
