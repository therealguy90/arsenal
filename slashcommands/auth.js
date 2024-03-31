const { SlashCommandBuilder } = require('discord.js');

const loginCommand = new SlashCommandBuilder()
    .setName('login')
    .setDescription('Login to your FVTT world.')
    .addStringOption((option) =>
        option.setName('link').setDescription('The public link to your FoundryVTT world.').setRequired(true)
    )
    .addStringOption((option) =>
        option.setName('username').setDescription('The username of the GM account for the bot.').setRequired(true)
    )
    .addStringOption((option) =>
        option.setName('password').setDescription('The password of the bot\'s GM account.').setRequired(false)
    );

const logoutCommand = new SlashCommandBuilder()
    .setName('logout')
    .setDescription('Logout from your FoundryVTT world.');

function registerAuthCommands(client, browser, pageMap, userdb) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isCommand()) return;
        const guildId = interaction.guildId;
        if (interaction.commandName === 'login') {
            const link = interaction.options.getString('link');
            const username = interaction.options.getString('username');
            let password = interaction.options.getString('password');
            if (pageMap.has(guildId)) {
                await interaction.reply("You've already logged in to your world from this server. Use /logout to close the current connection.")
            }
            else {
                let page;
                try {
                    // Launch a new page from the browser
                    await interaction.deferReply({ ephemeral: true });
                    page = await browser.newPage();
                    console.log(`Page created for guild ${guildId}`);
                    /*page.on('console', (message) => {
                        console.log(`Console Log: ${message.text()}`);
                    });*/
                    await page.goto(link)
                        .then(() => {
                            console.log(`Connected to ${link}`);
                        }).catch(err => {
                            interaction.editReply('Could not connect to FoundryVTT world.');
                            //page.close();
                            return;
                        });

                    console.log(`Attempting to login to ${page.url()}...`);
                    const currentLink = page.url();
                    if (currentLink.includes('/auth')) {
                        interaction.editReply('There is no world currently open on this server.');
                        page.close();
                        return;
                    }
                    await page.waitForSelector('select[name="userid"]');
                    let users = await page.evaluate(() => {
                        return JSON.stringify(Array.from(game.users));
                    });
                    users = JSON.parse(users);
                    let user;
                    users.forEach(fvttuser => {
                        if (fvttuser.name === username) {
                            user = fvttuser;
                            return;
                        }
                    });
                    if (user.role !== 4) {
                        await interaction.editReply('Please provide a valid GM account.');
                        page.close();
                        return;
                    }
                    const isActive = await page.evaluate((userid) => {
                        return game.users.get(userid).active;
                    }, user._id);
                    if (isActive) {
                        await interaction.editReply('User is already active from another client.');
                        page.close();
                        return;
                    }
                    await page.select('select[name="userid"]', user._id);
                    if (!password) {
                        password = "";
                    }
                    await page.type('input[name="password"]', password);
                    await page.click('button[name="join"]');
                    let response;
                    try {
                        response = await page.waitForResponse(response => response.status() === 401, { timeout: 1000 });
                    } catch (err) {
                        console.log("Login Success");
                    }
                    if (response) {
                        console.log("401 Unauthorized Error Detected");
                        page.close();
                        interaction.editReply('Unauthorized access. Are your credentials correct?')
                        return;
                    }
                    await interaction.editReply(`Login as ${user.name} successful!`);
                    await page.waitForFunction(() => {
                        try {
                            game.settings.set('core', 'noCanvas', true);
                            game.settings.set('core', 'maxFPS', 10);
                            game.settings.set('core', 'performanceMode', 0);
                            return true;
                        } catch (err) {
                            return false;
                        }
                    });
                    console.log('Core client settings set.');
                    pageMap.set(guildId, { page: page, userid: user._id });

                } catch (error) {
                    console.error('Error creating page:', error);
                    if (page) {
                        page.close();
                    }
                    interaction.editReply('An error occurred.');
                    return;
                }
            }
        } else if (interaction.commandName === 'logout') {
            if (!pageMap.has(guildId)) {
                await interaction.reply({ content: 'You are not logged in to any Foundry worlds.', ephemeral: true });
                return;
            }
            const { page, userid } = pageMap.get(guildId);
            page.close();
            pageMap.delete(guildId);
            await interaction.reply({ content: 'Logged out of the server.', ephemeral: true });
            console.log("Logged out from " + guildId);
        }

    });
}

module.exports = { loginCommand, logoutCommand, registerAuthCommands };