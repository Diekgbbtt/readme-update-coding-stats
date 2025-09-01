import "@testing-library/jest-dom";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { fetchRepo } from "../src/fetchers/repo.js";
import { expect, it, describe, afterEach } from "@jest/globals";

const data_repo = {
  repository: {
    name: "tlsscanner",
    stargazers: { totalCount: 0 },
    description: "",
    primaryLanguage: {
      color: "#",
      id: "",
      name: "",
    },
    forkCount: 0,
    defaultBranchRef: {
      target: {
        history: {
          totalCount: 2,
          nodes: [
            {
              oid: "abc123",
              author: { user: { id: "1", login: "testuser" } },
              additions: 10,
              deletions: 5
            },
            {
              oid: "def456", 
              author: { user: { id: "1", login: "testuser" } },
              additions: 15,
              deletions: 3
            }
          ]
        }
      }
    }
  },
};

const data_user = {
  data: {
    user: { repository: data_repo.repository },
    organization: null,
  },
};

const data_org = {
  data: {
    user: null,
    organization: { repository: data_repo.repository },
  },
};

const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

describe("Test fetchRepo", () => {
  it("should fetch correct user repo", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, data_user);

    let repo = await fetchRepo("diekgbbtt", "tlsscanner");

    expect(repo).toStrictEqual({
      repoMeta: {
        ...data_repo.repository,
        starCount: data_repo.repository.stargazers.totalCount,
      },
      repoCommits: {
        totalAdditions: 25,
        totalDeletions: 8,
      }
    });
  });

  it("should fetch correct org repo", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, data_org);

    let repo = await fetchRepo("diekgbbtt", "tlsscanner");
    expect(repo).toStrictEqual({
      repoMeta: {
        ...data_repo.repository,
        starCount: data_repo.repository.stargazers.totalCount,
      },
      repoCommits: {
        totalAdditions: 25,
        totalDeletions: 8,
      }
    });
  });

  it("should throw error if user is found but repo is null", async () => {
    mock
      .onPost("https://api.github.com/graphql")
      .reply(200, { data: { user: { repository: null }, organization: null } });

    await expect(fetchRepo("diekgbbtt", "tlsscanner")).rejects.toThrow(
      "User Repository Not found",
    );
  });

  it("should throw error if org is found but repo is null", async () => {
    mock
      .onPost("https://api.github.com/graphql")
      .reply(200, { data: { user: null, organization: { repository: null } } });

    await expect(fetchRepo("diekgbbtt", "tlsscanner")).rejects.toThrow(
      "Organization Repository Not found",
    );
  });

  it("should throw error if both user & org data not found", async () => {
    mock
      .onPost("https://api.github.com/graphql")
      .reply(200, { data: { user: null, organization: null } });

    await expect(fetchRepo("diekgbbtt", "tlsscanner")).rejects.toThrow(
      "Not found",
    );
  });

  it("should throw error if repository is private", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, {
      data: {
        user: { repository: { ...data_repo, isPrivate: true } },
        organization: null,
      },
    });

    await expect(fetchRepo("diekgbbtt", "tlsscanner")).rejects.toThrow(
      "User Repository Not found",
    );
  });
});
