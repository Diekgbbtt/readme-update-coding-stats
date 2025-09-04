// @ts-check
import { retryer } from "../common/retryer.js";
import { MissingParamError, request } from "../common/utils.js";

/**
 * @typedef {import('axios').AxiosRequestHeaders} AxiosRequestHeaders Axios request headers.
 * @typedef {import('axios').AxiosResponse} AxiosResponse Axios response.
 */

/**
 * Repo data fetcher.
 *
 * @param {object} reqPayload Fetcher graphQL post request data.
 * @param {string} token GitHub token.
 * @returns {Promise<AxiosResponse>} The response.
 */
const fetcher = (reqPayload, token) => {
  return request(
    {
      query: reqPayload.query,
      variables: reqPayload.variables,
    },
    {
      Authorization: `token ${token}`,
    },
  );
};


const filterDuplicateCommits = (branchesCommits) => {
  
  const uniqueCommits = [
    ...new Set(
      branchesCommits
        .map(node => node.target.history.nodes)
        .flat()
        .map(obj => JSON.stringify(obj))
    )
  ].map(str => JSON.parse(str));

  return uniqueCommits;

}



/**
 * Calculate total additions and deletions from commit history.
 *
 * @param {object} history - Commit history object
 * @param {Array} history.nodes - Array of commit objects
 * @returns {object} Object with additionsCount and deletionsCount
 */
const totalAdditionsAndDeletionsByUser = (branchesCommits, username) => {
  let additionsCount = 0;
  let deletionsCount = 0;

  const uniqueCommits = filterDuplicateCommits(branchesCommits);

  for (let i = 0; i < uniqueCommits.length; i++) {
    if (uniqueCommits[i].author.user && uniqueCommits[i].author.user.login.toLowerCase() === username.toLowerCase()) {
        additionsCount += uniqueCommits[i].additions || 0;
        deletionsCount += uniqueCommits[i].deletions || 0;
    }
  }

  return {
    additionsCount,
    deletionsCount
  };
};

/**
 * @typedef {import("./types").RepositoryCommitsData} RepositoryCommitsData Repository data.
*/

/**
 * Fetch repository data.
 *
 * @param {string} username GitHub username.
 * @param {string} reponame GitHub repository name.
 * @returns {Promise<RepositoryCommitsData>} Repository data.
 */
const fetchRepoCommits = async (username, reponame) => {

  const q_id = `
  {
    user(login: $login) {
      id
    }
  }
  `;

  let res_id = await retryer(fetcher, {query: q_id, variables: {login: username}});

  const data_id = res_id.data.data;

  if (!data_id.user) {
    throw new Error("Not found");
  }

  const id = data_id.user.id;

  const q = ` 
  {
  repository(owner: $login, name: $repo) {
    refs(refPrefix: "refs/heads/", first: 100) {
      nodes {
        name
        target {
          ... on Commit {
          history(first: 100, author: {id: $id}) {
            nodes {
              oid
              messageHeadline
              committedDate
              additions
              deletions
            }
          }
          }
        }
      }
    }
  }
}
`;

  let res = await retryer(fetcher, {query: q, variables: {login: username, repo: reponame, id}});

  const data = res.data.data;
  
  if (!data.repository || !data.repository.refs) {
    throw new Error("Repository or refs not found");
  }

  if (data.repository.refs.nodes.length === 0) {
    throw new Error("No commits found");
  }
  return totalAdditionsAndDeletionsByUser(data.repository.refs.nodes, username);
};
  /**
 * @typedef {import("./types").RepositoryMetaData} RepositoryMetaData Repository data.
*/

/**
 * Fetch repository data.
 *
 * @param {string} username GitHub username.
 * @param {string} reponame GitHub repository name.
 * @returns {Promise<RepositoryMetaData>} Repository data.
 */
const fetchRepoMeta = async (username, reponame) => {

  const q = `
    fragment RepoInfo on Repository {
      name
      nameWithOwner
      isPrivate
      isArchived
      isTemplate
      stargazers {
        totalCount
      }
      description
      primaryLanguage {
        color
        id
        name
      }
      forkCount
    }
    query getRepo($login: String!, $repo: String!) {
      user(login: $login) {
        repository(name: $repo) {
          ...RepoInfo
        }
      }
      organization(login: $login) {
        repository(name: $repo) {
          ...RepoInfo
        }
      }
    }
  `;

  let res = await retryer(fetcher, {query: q, variables: {login: username, repo: reponame}});

  const data = res.data.data;

  if (!data.user && !data.organization) {
    throw new Error("Not found");
  }

  const isUser = data.organization === null && data.user;
  const isOrg = data.user === null && data.organization;
  
  if (isUser) {
    if (!data.user.repository || data.user.repository.isPrivate) {
      throw new Error("User Repository Not found");
    }
    return {
      ...data.user.repository,
      starCount: data.user.repository.stargazers.totalCount
    };
  }

  if (isOrg) {
    if (
      !data.organization.repository ||
      data.organization.repository.isPrivate
    ) {
      throw new Error("Organization Repository Not found");
    }
    return {
      ...data.organization.repository,
      starCount: data.organization.repository.stargazers.totalCount,
    };
  }

  throw new Error("Unexpected behavior");
}

const urlExample = "/api/pin?username=USERNAME&amp;repo=REPO_NAME";

/**
 * @typedef {import("./types").RepositoryData} RepositoryData Repository data.
 */

/**
 * Fetch repository data.
 *
 * @param {string} username GitHub username.
 * @param {string} reponame GitHub repository name.
 * @returns {Promise<RepositoryData>} Repository data.
 */
const fetchRepo = async (username, reponame) => {
  if (!username && !reponame) {
    throw new MissingParamError(["username", "repo"], urlExample);
  }
  if (!username) {
    throw new MissingParamError(["username"], urlExample);
  }
  if (!reponame) {
    throw new MissingParamError(["repo"], urlExample);
  }

  let repoMeta = await fetchRepoMeta(username, reponame);
  let repoCommits = await fetchRepoCommits(username, reponame);

    return {
      ...repoMeta,
      ...repoCommits,
    };


  throw new Error("Unexpected behavior");
};

export { fetchRepo };
export default fetchRepo;
