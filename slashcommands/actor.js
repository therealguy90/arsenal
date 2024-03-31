const { SlashCommandBuilder } = require('discord.js');

const setActor = new SlashCommandBuilder()
    .setName('setactor')
    .setDescription('Associate yourself with a \'character\' type actor in the world.');

const setActorByName = new SlashCommandBuilder()
    .setName('setactorbyname')
    .addStringOption((option) =>
        option.setName('name').setDescription('The name of the actor. Case-sensitive.').setRequired(true)
    )
    .setDescription('Associate yourself with a \'character\' type actor in the world. This one uses the actor name.');

const unsetActor = new SlashCommandBuilder()
    .setName('unsetactor')
    .setDescription('Removes the current actor associated with your account.');

function registerActorCommands(client, pageMap, userdb) {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isCommand() && !interaction.isStringSelectMenu()) return;
        const guildId = interaction.guildId;
        if (interaction.commandName === 'setactor') {
            if (!pageMap.has(guildId)) {
                await interaction.reply({ content: "I'm not logged in to your world! Use /login to log in.", ephemeral: true });
                return;
            }
            try {
                await interaction.deferReply({ ephemeral: true });
                const { page, userid } = pageMap.get(guildId);
                const actors = JSON.parse(await page.evaluate(() => {
                    return JSON.stringify(Array.from(game.actors.filter(actor => actor.hasPlayerOwner)));
                }));
                const actorOptions = [];
                for (let i = 0; i < actors.length; i++) {
                    actorOptions.push({ label: actors[i].name, value: actors[i]._id });
                }
                if (actorOptions.length > 0) {
                    await interaction.editReply({
                        content: 'Please select a character:',
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 3,
                                        custom_id: 'actorSelect',
                                        options: actorOptions,
                                        placeholder: 'Select a character',
                                        max_values: 1
                                    }
                                ]
                            }
                        ]
                    });
                }
                else {
                    await interaction.editReply({ content: "There are no player-owned characters in the world." });
                    return;
                }
            } catch (err) {
                console.log(err);
                await interaction.editReply({ content: "An error occurred." });
            }
        }
        else if (interaction.commandName === 'setactorbyname') {
            if (!pageMap.has(guildId)) {
                await interaction.reply({ content: "I'm not logged in to your world! Use /login to log in.", ephemeral: true });
                return;
            }
            const actorname = interaction.options.getString('name');
            await interaction.deferReply({ ephemeral: true });
            try {
                const { page, userid } = pageMap.get(guildId);
                const actorId = await page.evaluate((actorname) => {
                    return game.actors.find(actor => actor.name === actorname).id;
                }, actorname);
                if (actorId) {
                    const actorName = await page.evaluate((actorid) => {
                        return game.actors.get(actorid).name;
                    }, actorId);
                    await interaction.editReply(`${actorName} has been selected as your active character!`);
                    userdb.run("INSERT OR REPLACE INTO users (userid, actorid) VALUES (?, ?)", [interaction.member.user.id, actorId]);
                }
                else {
                    await interaction.editReply("Actor with that name can't be found.");
                }
            } catch (err) {
                await interaction.editReply({ content: "An error occured. Did you type the name correctly? Your Actor might have a different name than your Token." });
                return;
            }
        }
        else if (interaction.commandName === 'unsetactor') {
            try {
                userdb.run("DELETE FROM users WHERE userid = ?", [interaction.member.user.id]);
                await interaction.reply({ content: "You no longer have an associated actor." });
            } catch (err) {
                console.log(err);
                await interaction.reply({ content: "An error occurred." });
            }
        } else if (interaction.isStringSelectMenu() && interaction.customId === 'actorSelect') {
            const selectedActorId = interaction.values[0];
            try {
                await interaction.deferReply({ ephemeral: true });
                const { page, userid } = pageMap.get(guildId);
                const actorName = await page.evaluate((actorid) => {
                    return game.actors.get(actorid).name;
                }, selectedActorId);
                await interaction.editReply(`${actorName} has been selected as your active character!`);
                userdb.run("INSERT OR REPLACE INTO users (userid, actorid) VALUES (?, ?)", [interaction.member.user.id, selectedActorId]);
            }
            catch (err) {
                console.log(err);
                await interaction.editReply({ content: "An error occurred." });
            }
        }
    });
}

module.exports = { setActor, setActorByName, unsetActor, registerActorCommands };