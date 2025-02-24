const adjectives = [
  "fractious",
  "whimsical",
  "zealous",
  "dazzling",
  "ethereal",
  "tenacious",
  "luminous",
  "mystical",
  "radiant",
  "vivacious",
  "jubilant",
  "serene",
  "cosmic",
  "dynamic",
  "enigmatic",
  "mystical",
  "radiant",
  "vivacious",
  "jubilant",
  "serene",
  "cosmic",
  "dynamic",
];

const animals = [
  "monkfish",
  "phoenix",
  "griffin",
  "dragon",
  "unicorn",
  "kraken",
  "sphinx",
  "chimera",
  "pegasus",
  "hydra",
  "lynx",
  "falcon",
  "octopus",
  "panther",
  "dolphin",
  "tiger",
  "elephant",
  "giraffe",
  "hippopotamus",
  "kangaroo",
  "leopard",
  "lion",
];

export function generateDemoName(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adjective}-${animal}`;
}
