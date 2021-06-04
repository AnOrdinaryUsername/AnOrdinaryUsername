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

  for (let i = 0; i < data.length; i++) {
    const repo = data[i];

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
  }

  const totalCommits = await getTotalCommits(
    contributorRequests,
    githubUsername,
    lastYear
  );

  return totalCommits;
}

async function getTotalCommits(requests, contributor, lastYear) {
  const totalCommits = await Promise.all(requests).then((repos) => {
    let total = 0;

    repos.forEach((repo) => {
      const indexOfContributor = repo.data.findIndex(
        (item) => item.author.login === contributor
      );

      if (indexOfContributor !== -1) {
        const olderThanAYear = (week) => {
          // week.w -> Start of the week, given as a Unix timestamp
          const MILLISECONDS = week.w * 1000;
          const startOfWeek = new Date(MILLISECONDS);
          return startOfWeek > lastYear;
        };

        const newestWeeks =
          repo.data[indexOfContributor].weeks.filter(olderThanAYear);

        // week.c -> Number of commits
        total += newestWeeks.reduce(
          (totalCommits, week) => totalCommits + week.c,
          0
        );
      }
    });

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
