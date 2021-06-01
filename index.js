require("dotenv").config();
const Mustache = require("mustache");
const fs = require("fs");
const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  userAgent: "readme v1.0.0",
  baseUrl: "https://api.github.com",
  log: {
    warn: console.warn,
    error: console.error,
  },
});

async function grabDataFromAllRepositories() {
  const request = await octokit
    .request("GET /user/repos")
    .then((repos) => repos);
  return request.data;
}

function calculateTotalStars(data) {
  const stars = data.map((repo) => repo.stargazers_count);
  const totalStars = stars.reduce((prev, curr) => prev + curr, 0);
  return totalStars;
}

async function calculateTotalCommits(data) {
  // TODO
}

async function updateReadme(userData) {
  const TEMPLATE_PATH = "./main.mustache";
  await fs.readFile(TEMPLATE_PATH, (err, data) => {
    if (err) {
      throw err;
    }

    const output = Mustache.render(data.toString(), userData);
    fs.writeFileSync("README.md", output);
  });
}

async function main() {
  const repoData = await grabDataFromAllRepositories();

  const totalStars = calculateTotalStars(repoData);

  await updateReadme({ totalStars });
}

main();
