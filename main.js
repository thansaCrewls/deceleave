const { Client } = require("discord.js-selfbot-v13");
const readline = require("readline");
const fs = require("fs");
const banner = require("./config/banner");

// Constants
const LEAVE_DELAY = 5000; // 5 seconds delay between each leave
const ACCOUNTS_FILE = "accounts.json"; // File to store account tokens
const LOG_FILE = "log.txt"; // File to store logs
const GROUPS_FILE = "namagroup.txt"; // File to store group names

// Display banner when program starts
console.log(banner);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Utility function for delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Promise wrapper for readline question
function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Function to clear console and move cursor to top
function clearConsole() {
  console.clear();
  process.stdout.write("\x1B[0f");
  console.log(banner);
}

// Function to get current timestamp
function getTimestamp() {
  const now = new Date();
  return now.toISOString();
}

// Function to write logs to both console and file
function log(message, isError = false) {
  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
  
  // Append to log file dengan timestamp
  const timestamp = getTimestamp();
  const logMessage = `[${timestamp}] ${message}`;
  fs.appendFileSync(LOG_FILE, logMessage + "\n", "utf-8");
}

// Load account tokens from file
function loadAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    log(`❌ File "${ACCOUNTS_FILE}" not found. Create it with account tokens.`, true);
    process.exit();
  }

  const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
  if (!Array.isArray(accounts) || accounts.length === 0) {
    log(`❌ No valid accounts found in "${ACCOUNTS_FILE}".`, true);
    process.exit();
  }
  
  log(`✅ Loaded ${accounts.length} account(s) from "${ACCOUNTS_FILE}".`);
  return accounts;
}

// Function to save all group names with IDs to file
function saveGroupNames(groups) {
  const groupNames = groups.map(g => `${g.name}|${g.id}`).join("\n");
  fs.writeFileSync(GROUPS_FILE, groupNames, "utf-8");
  log(`✅ Saved ${groups.length} group name(s) with ID to "${GROUPS_FILE}".`);
}

// Start the program
(async function () {
  log("========== PROGRAM STARTED ==========");
  
  const accounts = loadAccounts();

  log("Options:");
  log("1. List and select servers to leave");
  log("2. Leave server by ID from file");
  log("3. Leave all servers");
  log("4. Leave server by invite link");
  log("5. Leave servers by invite links from file");
  log("6. Save all group names to file");

  const processChoice = await question("\nSelect a process to perform (1/2/3/4/5/6): ");

  if (!["1", "2", "3", "4", "5", "6"].includes(processChoice)) {
    log("❌ Invalid process choice. Exiting...", true);
    rl.close();
    process.exit();
  }

  log(`Selected process: ${processChoice}`);

  log("Options:");
  log("1. Single account");
  log("2. All accounts");

  const accountChoice = await question("\nSelect an option for accounts (1/2): ");

  if (accountChoice === "1") {
    log("Available Accounts:");
    accounts.forEach((account, index) => {
      log(`${index + 1}. ${account.name || `Account ${index + 1}`}`);
    });

    const selectedAccountIndex = await question("\nSelect an account by number: ");
    const selectedIndex = parseInt(selectedAccountIndex, 10) - 1;

    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= accounts.length) {
      log("❌ Invalid selection. Exiting...", true);
      rl.close();
      process.exit();
    }

    const selectedAccount = accounts[selectedIndex];
    log(`Selected Account: ${selectedAccount.name || `Account ${selectedIndex + 1}`}`);
    await processAccount(selectedAccount.token, processChoice);
  } else if (accountChoice === "2") {
    log("Processing all accounts...");
    for (const account of accounts) {
      log(`Processing Account: ${account.name || `Account`}`);
      await processAccount(account.token, processChoice);
    }
    log("Finished processing all accounts.");
    log("========== PROGRAM ENDED ==========\n");
    rl.close();
    process.exit();
  } else {
    log("❌ Invalid account choice. Exiting...", true);
    log("========== PROGRAM ENDED ==========\n");
    rl.close();
    process.exit();
  }
})();

// Function to process a single account
async function processAccount(token, processChoice) {
  const client = new Client({
    checkUpdate: false,
  });

  return new Promise((resolve) => {
    client.on("ready", async () => {
      log(`Logged in as ${client.user.tag}!`);

      if (processChoice === "1") {
        await handleServerSelection(client);
      } else if (processChoice === "2") {
        await handleLeaveByIDFromFile(client);
      } else if (processChoice === "3") {
        await handleLeaveAllServers(client);
      } else if (processChoice === "4") {
        await handleLeaveByInviteLink(client);
      } else if (processChoice === "5") {
        await handleLeaveByInviteLinkFromFile(client);
      } else if (processChoice === "6") {
        await handleSaveGroupNames(client);
      } else {
        log("Invalid choice. Skipping...");
      }

      client.destroy();
      log("========== ACCOUNT SESSION ENDED ==========\n");
      resolve();
    });

    client.login(token).catch((error) => {
      log(`Failed to login with token: ${error.message}`, true);
      resolve();
    });
  });
}

// Function to handle server selection
async function handleServerSelection(client) {
  const servers = Array.from(client.guilds.cache.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((guild, index) => ({
      index: index + 1,
      id: guild.id,
      name: guild.name,
      joinedAt: guild.joinedAt.toDateString(),
    }));

  log("Servers:");
  servers.forEach((server) => {
    log(`${server.index}. ${server.name} (ID: ${server.id})`);
  });

  const serverIDs = await question("\nEnter the IDs of servers to leave (comma-separated): ");
  const idsToLeave = serverIDs.split(",").map((id) => id.trim());

  log(`Starting server leave process for ${idsToLeave.length} server(s)...`);
  for (let i = 0; i < idsToLeave.length; i++) {
    const id = idsToLeave[i];
    const guild = client.guilds.cache.get(id);

    if (guild) {
      try {
        await guild.leave();
        log(`✅ Successfully left server: ${guild.name}`);
      } catch (error) {
        log(`Failed to leave server with ID ${id}: ${error.message}`, true);
      }
    } else {
      log(`Server with ID ${id} not found or already left.`);
    }

    if (i < idsToLeave.length - 1) {
      await delay(LEAVE_DELAY);
    }
  }

  log("Finished server selection process.");
}

// Function to leave servers by ID from file
async function handleLeaveByIDFromFile(client) {
  const filePath = "serverid.txt";

  if (!fs.existsSync(filePath)) {
    log(`File "${filePath}" not found. Please create it and add server IDs.`, true);
    return;
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const idsToLeave = fileContent.split("\n").map((id) => id.trim()).filter(Boolean);

  if (idsToLeave.length === 0) {
    log(`No valid server IDs found in "${filePath}".`, true);
    return;
  }

  log(`Starting server leave process for ${idsToLeave.length} server(s) from file...`);
  for (let i = 0; i < idsToLeave.length; i++) {
    const id = idsToLeave[i];
    const guild = client.guilds.cache.get(id);

    if (guild) {
      try {
        await guild.leave();
        log(`✅ Successfully left server: ${guild.name}`);
      } catch (error) {
        log(`Failed to leave server with ID ${id}: ${error.message}`, true);
      }
    } else {
      log(`Server with ID ${id} not found or already left.`);
    }

    if (i < idsToLeave.length - 1) {
      await delay(LEAVE_DELAY);
    }
  }

  log("Finished leave by ID from file process.");
}

// Function to leave a server using an invite link
async function handleLeaveByInviteLink(client) {
  const inviteLink = await question("\nEnter the invite link: ");
  const inviteCode = inviteLink.split("/").pop();

  try {
    const invite = await client.fetchInvite(inviteCode);
    const guildId = invite.guild.id;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      log(`You are not a member of the server: ${invite.guild.name}`);
    } else {
      await guild.leave();
      log(`✅ Successfully left server: ${invite.guild.name}`);
    }
  } catch (error) {
    log(`Failed to process invite link: ${error.message}`, true);
  }
}

// Function to leave servers using invite links from a file
async function handleLeaveByInviteLinkFromFile(client) {
  const filePath = "invitelink.txt";

  if (!fs.existsSync(filePath)) {
    log(`File "${filePath}" not found. Please create it and add invite links.`, true);
    return;
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const inviteLinks = fileContent.split("\n").map((link) => link.trim()).filter(Boolean);

  if (inviteLinks.length === 0) {
    log(`No valid invite links found in "${filePath}".`, true);
    return;
  }

  log(`Starting to leave ${inviteLinks.length} server(s) using invite links...`);
  for (let i = 0; i < inviteLinks.length; i++) {
    const inviteLink = inviteLinks[i];
    const inviteCode = inviteLink.split("/").pop();

    try {
      const invite = await client.fetchInvite(inviteCode);
      const guildId = invite.guild.id;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        log(`You are not a member of the server: ${invite.guild.name}`);
      } else {
        await guild.leave();
        log(`✅ Successfully left server: ${invite.guild.name}`);
      }
    } catch (error) {
      log(`Failed to process invite link (${inviteLink}): ${error.message}`, true);
    }

    if (i < inviteLinks.length - 1) {
      await delay(LEAVE_DELAY);
    }
  }

  log("Finished processing invite links.");
}

// Function to leave all servers
async function handleLeaveAllServers(client) {
  const servers = Array.from(client.guilds.cache.values());

  if (servers.length === 0) {
    log("You are not a member of any servers.");
    log("========== PROGRAM ENDED ==========\n");
    rl.close();
    process.exit();
  }

  log(`Starting to leave all ${servers.length} server(s)...`);
  for (let i = 0; i < servers.length; i++) {
    const guild = servers[i];

    try {
      await guild.leave();
      log(`✅ Successfully left server: ${guild.name}`);
    } catch (error) {
      log(`Failed to leave server: ${guild.name} (ID: ${guild.id}): ${error.message}`, true);
    }

    if (i < servers.length - 1) {
      await delay(LEAVE_DELAY);
    }
  }

  log("Finished leaving all servers.");
  log("========== PROGRAM ENDED ==========\n");
  rl.close();
  process.exit();
}

// Function to save all group names
async function handleSaveGroupNames(client) {
  const servers = Array.from(client.guilds.cache.values())
    .sort((a, b) => a.name.localeCompare(b.name));

  if (servers.length === 0) {
    log("You are not a member of any servers.");
    return;
  }

  log(`Found ${servers.length} group(s). Saving to file...`);
  saveGroupNames(servers);
  
  log("Group names saved:");
  servers.forEach((server, index) => {
    log(`${index + 1}. ${server.name}|${server.id}`);
  });

  log("Finished saving group names.");
  log("========== PROGRAM ENDED ==========\n");
  rl.close();
  process.exit();
}
