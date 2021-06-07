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
  const request = await octokit.request("GET /user/repos");
  return request.data;
}

function calculateTotalStars(data) {
  const stars = data.map((repo) => repo.stargazers_count);
  const totalStars = stars.reduce((sum, curr) => sum + curr, 0);
  return totalStars;
}

async function calculateTotalCommitsInPastYear(data) {
  const contributorRequests = [];
  const githubUsername = process.env.GH_USERNAME;
  const today = new Date();

  const previousYear = {
    year: today.getFullYear() - 1,
    month: today.getMonth(),
    day: today.getDate(),
    hour: today.getHours(),
    minutes: today.getMinutes(),
    seconds: today.getSeconds(),
  };

  const lastYear = new Date(Date.UTC(...Object.values(previousYear)));

  data.forEach((repo) => {
    const options = {
      owner: githubUsername,
      repo: repo.name,
    };

    const lastRepoUpdate = new Date(repo.updated_at);

    if (lastRepoUpdate > lastYear) {
      // https://docs.github.com/en/rest/reference/repos#get-all-contributor-commit-activity
      const repoStats = octokit.request(
        "GET /repos/{owner}/{repo}/stats/contributors",
        options
      );

      contributorRequests.push(repoStats);
    }
  });

  const totalCommits = await getTotalCommits(
    contributorRequests,
    githubUsername,
    lastYear
  );

  return totalCommits;
}

async function getTotalCommits(requests, contributor, cutoffDate) {
  const repos = await Promise.all(requests);
  let totalCommits = 0;

  repos.forEach((repo) => {
    const contributorName = (item) => item.author.login === contributor;
    const indexOfContributor = repo.data.findIndex(contributorName);

    if (indexOfContributor !== -1) {
      const youngerThanCutoffDate = (week) => {
        // week.w -> Start of the week, given as a Unix timestamp (which is in seconds)
        const MILLISECONDS_IN_A_SECOND = 1000;
        const milliseconds = week.w * MILLISECONDS_IN_A_SECOND;
        const startOfWeek = new Date(milliseconds);
        return startOfWeek > cutoffDate;
      };

      const newestWeeks = repo.data[indexOfContributor].weeks.filter(
        youngerThanCutoffDate
      );

      // week.c -> Number of commits in a week
      totalCommits += newestWeeks.reduce((sum, week) => sum + week.c, 0);
    }
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

  // Hex color codes for the color blocks
  const colors = ["474342", "fbedf6", "c9594d", "f8b9b2", "ae9c9d"];
  await updateReadme({ totalStars, totalCommitsInPastYear, colors });
}

main();
