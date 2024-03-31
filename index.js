const Discord = require('discord.js');
const puppeteer = require('puppeteer');
const yaml = require('js-yaml');
const sqlite3 = require('sqlite3');
const fs = require('fs'); // You need to include the 'fs' module to read the config file

let bot_token;
try {
    const configString = fs.readFileSync('config.yaml', 'utf8');
    const config = yaml.load(configString);
    bot_token = config.development.bot_token;
} catch (e) {
    console.error('Error loading config:', e);
}

if (bot_token && dburl) {

    const db = new sqlite3.Database('./databases/users.db');
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
        if (err) {
            console.error(err.message);
            return;
        }

        if (row) {
            console.log('Table already exists in users.db');
        } else {
            // Create the table if it doesn't exist
            db.run('CREATE TABLE users (userid TEXT, actorid TEXT)', (err) => {
                if (err) {
                    console.error(err.message);
                    return;
                }
                console.log('Table created successfully');
            });
        }
    });
    const pageMap = new Map();
    let browser; 
    puppeteer.launch({ headless: true, devtools: true, args: ['--window-size=1024,700', '--no-sandbox'] })
    .then(puppeteerBrowser => {
        browser = puppeteerBrowser;
    })
    const { loginCommand, logoutCommand } = require('./slashcommands/auth.js');
    const { registerAuthCommands } = require('./slashcommands/auth.js');
    const { setActor, setActorByName, unsetActor } = require('./slashcommands/actor.js');
    const { registerActorCommands } = require('./slashcommands/actor.js');

    const client = new Discord.Client({
        intents: [
            Discord.GatewayIntentBits.Guilds,
            Discord.GatewayIntentBits.GuildMembers,
            Discord.GatewayIntentBits.GuildMessages,
        ],
    });

    async function registerCommands(guild) {
        await guild.commands.set([
            loginCommand.toJSON(),
            logoutCommand.toJSON(),
            setActor.toJSON(),
            setActorByName.toJSON(),
            unsetActor.toJSON(),
        ]); // Register the commands to the guild
        console.log(`Registered commands in guild: ${guild.id}`);
    }

    client.on('ready', async () => {
        try {
            const guilds = client.guilds.cache; // Get all guilds the bot is in
            for (const [guildId, guild] of guilds) {
                await registerCommands(guild);
            }
            console.log('All commands registered successfully.');
        } catch (error) {
            console.error('Error registering commands:', error);
        }
        registerAuthCommands(client, browser, pageMap, db);
        registerActorCommands(client, pageMap, db);
        console.log(`${client.user.tag}, Ready.`);
        console.log(`Logged into ${client.guilds.cache.size} guilds`);
    });
    client.on('guildCreate', (guild) => {
        console.log(`Bot joined guild: ${guild.name}`);
        registerCommands(guild);
    });
    client.on('error', (error) => {
        console.error('An error occurred:', error);
    });

    client.login(bot_token);
}