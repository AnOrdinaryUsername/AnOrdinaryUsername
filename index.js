require("dotenv").config();
const Mustache = require("mustache");
const fs = require("fs");
const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({
  auth: process.env.GH_ACCESS_TOKEN,
  userAgent: "readme v1.0.0",
  baseUrl: "https://api.github.com",
  log: {
    warn: console.warn,
    error: console.error,
  },
});

async function grabDataFromAllRepositories() {
  // https://docs.github.com/en/rest/reference/repos#list-repositories-for-the-authenticated-user
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

async function calculateTotalCommitsInPastYear(data) {
  const requestPromises = [];

  for (let i = 0; i < data.length; i++) {
    const options = {
      owner: data[i].owner.login,
      repo: data[i].name,
    };

    // https://docs.github.com/en/rest/reference/repos#get-the-last-year-of-commit-activity
    const repoStats = octokit.request(
      "GET /repos/{owner}/{repo}/stats/commit_activity",
      options
    );

    requestPromises.push(repoStats);
  }

  const totalCommits = await Promise.all(requestPromises).then((repos) => {
    let total = 0;

    for (let i = 0; i < repos.length; ++i) {
      const weeksInAYear = repos[i].data.length;

      for (let j = 0; j < weeksInAYear; ++j) {
        const totalCommitsInWeek = repos[i].data[j].total;
        total += totalCommitsInWeek;
      }
    }

    return total;
  });

  return totalCommits;
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
  const totalCommitsInPastYear = await calculateTotalCommitsInPastYear(
    repoData
  );

  await updateReadme({ totalStars, totalCommitsInPastYear });
}

main();
