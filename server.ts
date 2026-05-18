import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionFlagsBits,
  REST,
  Routes,
  StringSelectMenuOptionBuilder,
  Interaction,
  CacheType,
  ComponentType,
  TextChannel,
  Message,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const PORT = 3000;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

const ticketLogs: any[] = [];
let categoryMap: Record<string, string> = {
  support: 'General Support',
  report: 'User Report',
  partner: 'Partnerships',
  army: 'Army Inquiries'
};

let customFormConfig = {
  title: '📝 Staff Application',
  description: 'Click below to start.',
  buttonLabel: 'Apply Now',
  questions: [
    'What is your Discord username and age?',
    'Why do you want to become a staff member on this server?',
    'How would you handle a member breaking the rules?',
    'How active can you be on the server each day?',
    'Why should we choose you for the staff team?'
  ]
};

const configPath = path.join(process.cwd(), 'customFormConfig.json');
try {
  if (fs.existsSync(configPath)) {
    customFormConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch(err) {
  console.error('Failed to parse customFormConfig', err);
}

let staffRoleIds: string[] = [];

const appSessions = new Map<string, {
  userId: string;
  channelId: string;
  questions: string[];
  currentQuestionIndex: number;
  answers: { question: string, answer: string }[];
}>();

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- Discord Bot Setup ---
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const commands = [
    {
      name: 'setup',
      description: 'Deploy the ticket creation message with dropdown categories',
      default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    },
    {
      name: 'send',
      description: 'Send a custom message from the bot',
      options: [
        {
          name: 'message',
          description: 'The content of the message to send',
          type: 3, // String
          required: true,
        },
        {
          name: 'channel',
          description: 'The channel to send the message to (defaults to current)',
          type: 7, // Channel
          required: false,
        }
      ],
      default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    },
    {
      name: 'status',
      description: 'Check the bot status',
    }
  ];

  async function registerCommands() {
    if (!DISCORD_TOKEN || !CLIENT_ID) {
      console.warn('⚠️ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID. Commands will not be registered.');
      return;
    }

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    try {
      console.log('Started refreshing application (/) commands.');
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
      console.error('Error registering commands:', error);
    }
  }

  client.on('ready', () => {
    console.log(`🚀 Logged in as ${client.user?.tag}!`);
    registerCommands();
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const session = appSessions.get(message.channel.id);
    if (session && session.userId === message.author.id) {
      session.answers.push({
        question: session.questions[session.currentQuestionIndex],
        answer: message.content
      });

      session.currentQuestionIndex++;
      
      if (session.currentQuestionIndex < session.questions.length) {
        await message.channel.send(`**Question ${session.currentQuestionIndex + 1}/${session.questions.length}:** ${session.questions[session.currentQuestionIndex]}`);
      } else {
        appSessions.delete(message.channel.id);
        
        const appEmbed = new EmbedBuilder()
          .setTitle(`${customFormConfig.title}: ${message.author.tag}`)
          .setDescription('Application completed. Awaiting staff review.')
          .addFields(
            session.answers.map(a => ({ name: a.question.substring(0, 256), value: a.answer.substring(0, 1024), inline: false }))
          )
          .setColor('#9B59B6')
          .setTimestamp();

        const closeButton = new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒');

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

        await message.channel.send({ 
          content: `<@${message.author.id}> Form Questions Completed!`,
          embeds: [appEmbed], 
          components: [row] 
        });
      }
    }
  });

  client.on('interactionCreate', async (interaction: Interaction<CacheType>) => {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setup') {
        const embed = new EmbedBuilder()
          .setTitle('🎫 ʀᴇᴀʟᴢʏᴠᴏᴋ ᴀʀᴍʏ | ꜱᴜᴘᴘᴏʀᴛ ᴄᴇɴᴛᴇʀ')
          .setDescription('Welcome to the **Realzyvok Army Support Center**.\nTo provide you with the best experience, please select a category below.\n\n┃ 🛠️ **Support** - General questions.\n┃ 🛡️ **Reports** - Report a user.\n┃ 🤝 **Partners** - Collaborations.\n\n╰ *Please avoid opening multiple tickets.*')
          .setColor('#5865F2')
          .setThumbnail(client.user?.displayAvatarURL() || null);

        const select = new StringSelectMenuBuilder()
          .setCustomId('ticket_category')
          .setPlaceholder('Select a ticket category...')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('General Support')
              .setValue('support')
              .setDescription('General questions or help with the server')
              .setEmoji('🛠️'),
            new StringSelectMenuOptionBuilder()
              .setLabel('User Report')
              .setValue('report')
              .setDescription('Report a user for any reason')
              .setEmoji('🛡️'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Partnerships')
              .setValue('partner')
              .setDescription('Inquiries about partnerships or collaborations')
              .setEmoji('🤝'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Army Inquiries')
              .setValue('army')
              .setDescription('Army related questions and info')
              .setEmoji('🏆')
          );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

        await interaction.reply({ embeds: [embed], components: [row] });
      }

      if (interaction.commandName === 'send') {
        const messageInput = interaction.options.getString('message', true);
        const targetChannel = (interaction.options.getChannel('channel') || interaction.channel) as TextChannel;

        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
          return interaction.reply({ content: '❌ Invalid text channel.', ephemeral: true });
        }

        try {
          await targetChannel.send({ content: messageInput });
          await interaction.reply({ content: `✅ Message sent to ${targetChannel}!`, ephemeral: true });
        } catch (error) {
          await interaction.reply({ content: '❌ Failed to send message.', ephemeral: true });
        }
      }

      if (interaction.commandName === 'status') {
        await interaction.reply({ content: `✅ Bot is online! Latency: ${client.ws.ping}ms`, ephemeral: true });
      }
    }

    // Handle Dropdown Selection
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category') {
      const category = interaction.values[0];

      const categoryLabel = categoryMap[category] || (category.charAt(0).toUpperCase() + category.slice(1));

      const guild = interaction.guild;
      if (!guild) return;

      await interaction.reply({ content: `⏳ Creating your **${categoryLabel}** ticket...`, ephemeral: true });

      try {
        // Find or create '🎫 ᴛɪᴄᴋᴇᴛꜱ' category
        let categoryChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === '🎫 ᴛɪᴄᴋᴇᴛꜱ');
        
        // Check for existing ticket
        const userSuffix = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        const existingTicket = guild.channels.cache.find(c => 
          c.type === ChannelType.GuildText && 
          (c.parentId === categoryChannel?.id) && 
          c.name.includes(userSuffix)
        );

        if (existingTicket) {
          await interaction.editReply({ content: `❌ You already have an open ticket: ${existingTicket}` });
          setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
          return;
        }

        if (!categoryChannel) {
          try {
            categoryChannel = await guild.channels.create({
              name: '🎫 ᴛɪᴄᴋᴇᴛꜱ',
              type: ChannelType.GuildCategory,
            });
          } catch (err) {
            console.error('Failed to create category:', err);
          }
        }

        const channel = await guild.channels.create({
          name: `${category}-${interaction.user.username}`.toLowerCase(),
          type: ChannelType.GuildText,
          parent: categoryChannel?.id,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: interaction.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            },
          ],
        });

        const ticketEmbed = new EmbedBuilder()
          .setTitle(`ʀᴇᴀʟᴢʏᴠᴏᴋ: ${categoryLabel}`)
          .setDescription(`Hello ${interaction.user}! Welcome to your support ticket. Please describe your issue in detail, and a staff member will assist you shortly.`)
          .addFields(
            { name: 'Category', value: categoryLabel, inline: true },
            { name: 'Opened By', value: interaction.user.tag, inline: true }
          )
          .setColor('#2ECC71')
          .setTimestamp();

        const closeButton = new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒');

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

        await channel.send({ embeds: [ticketEmbed], components: [row] });
        await interaction.editReply({ content: `✅ Ticket created: ${channel}` });

        // Auto-delete the confirmation message after 5 seconds
        setTimeout(() => {
          interaction.deleteReply().catch(() => {});
        }, 5000);

      } catch (error) {
        console.error('Failed to create ticket channel:', error);
        await interaction.editReply({ content: '❌ Failed to create your ticket. Please make sure I have "Manage Channels" permissions.' });
      }
    }

    // Handle Form Button Click
    if (interaction.isButton() && interaction.customId === 'open_custom_form') {
      const guild = interaction.guild;
      if (!guild) return;

      await interaction.reply({ content: `⏳ Setting up your application...`, ephemeral: true });

      try {
        let categoryChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === '🎫 ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴꜱ');
        
        const userSuffix = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        const existingTicket = guild.channels.cache.find(c => 
          c.type === ChannelType.GuildText && 
          (c.parentId === categoryChannel?.id) && 
          c.name.includes(userSuffix)
        );

        if (existingTicket) {
          await interaction.editReply({ content: `❌ You already have an open application: ${existingTicket}` });
          setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
          return;
        }

        if (!categoryChannel) {
          try {
            categoryChannel = await guild.channels.create({
              name: '🎫 ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴꜱ',
              type: ChannelType.GuildCategory,
            });
          } catch (err) {
            console.error('Failed to create apps category:', err);
          }
        }

        const channel = await guild.channels.create({
          name: `app-${interaction.user.username}`.toLowerCase(),
          type: ChannelType.GuildText,
          parent: categoryChannel?.id,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: interaction.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            },
          ],
        });

        // Initialize session
        appSessions.set(channel.id, {
          userId: interaction.user.id,
          channelId: channel.id,
          questions: customFormConfig.questions,
          currentQuestionIndex: 0,
          answers: []
        });

        const closeButtonInit = new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Application')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒');

        const rowInit = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButtonInit);

        await channel.send({ 
          content: `<@${interaction.user.id}> Welcome! Let's start your application.\n\n**Question 1/${customFormConfig.questions.length}:** ${customFormConfig.questions[0]}`,
          components: [rowInit]
        });
        
        await interaction.editReply({ content: `✅ Application started in ${channel}` });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      } catch (error) {
         console.error('Failed to create app ticket:', error);
         await interaction.editReply({ content: '❌ Failed to start application.' });
      }
      return;
    }

    // Handle Button Click (Close Ticket)
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      const channel = interaction.channel as TextChannel;
      if (!channel || channel.type !== ChannelType.GuildText) return;

      // Permission Check: Only staff/admins or the ticket creator can close
      const member = interaction.member as any;
      const isStaff = member?.permissions.has(PermissionFlagsBits.Administrator) || member?.roles?.cache?.some((r: any) => staffRoleIds.includes(r.id));
      const userSuffix = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isCreator = channel.name.includes(userSuffix);
      
      if (!isStaff && !isCreator) {
        return interaction.reply({ 
          content: '❌ Only staff members or the ticket creator can close this ticket!', 
          ephemeral: true 
        });
      }

      await interaction.reply({ content: '🎫 Archiving and closing ticket in 5 seconds...' });
      
      const logEntry = {
        id: channel.id,
        user: interaction.user.tag,
        guild: interaction.guild?.name,
        timestamp: new Date().toISOString(),
        category: (channel.name.split('-')[0]) || 'General',
        transcript: ''
      };

      // Fetch transcript before deletion
      try {
        const messages = await channel.messages.fetch({ limit: 50 });
        logEntry.transcript = messages
          .filter(m => !m.author.bot)
          .reverse()
          .map(m => `${m.author.username}: ${m.content}`)
          .join('\n');
      } catch (err) {
        console.error('Transcript fetch failed:', err);
      }
      
      ticketLogs.unshift(logEntry);
      if (ticketLogs.length > 50) ticketLogs.pop();

      setTimeout(async () => {
        try {
          await channel.delete();
        } catch (error) {
          console.error('Failed to delete channel:', error);
        }
      }, 5000);
    }
  });

  if (DISCORD_TOKEN) {
    client.login(DISCORD_TOKEN).catch(err => {
      console.error('Failed to login to Discord:', err);
    });
  } else {
    console.warn('⚠️ DISCORD_TOKEN is missing. Bot functionality is disabled.');
  }

  // --- API Routes ---
  // API routes go here FIRST
  app.get('/ping', (req, res) => {
    res.send('pong');
  });

  app.get('/api/status', (req, res) => {
    // Count active tickets across all guilds the bot is in
    const ticketCategories = ['support-', 'report-', 'partner-', 'army-', 'app-'];
    let activeTickets = 0;
    
    if (client.isReady()) {
      client.guilds.cache.forEach(guild => {
        activeTickets += guild.channels.cache.filter(channel => 
          channel.type === ChannelType.GuildText && 
          ticketCategories.some(cat => channel.name.startsWith(cat))
        ).size;
      });
    }

    res.json({
      status: client.isReady() ? 'online' : 'offline',
      configStatus: {
        hasToken: !!process.env.DISCORD_TOKEN,
        hasClientId: !!process.env.DISCORD_CLIENT_ID
      },
      user: client.user?.tag || null,
      guilds: client.guilds.cache.size,
      ping: client.ws.ping,
      uptime: client.uptime,
      activeTickets: activeTickets
    });
  });

  app.get('/api/tickets', (req, res) => {
    if (!client.isReady()) return res.status(503).json({ error: 'Bot is not ready' });
    
    const ticketCategories = ['support-', 'report-', 'partner-', 'army-', 'app-'];
    const tickets: any[] = [];
    
    client.guilds.cache.forEach(guild => {
      const guildTickets = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText && ticketCategories.some(cat => c.name.startsWith(cat)))
        .map(c => ({
          id: c.id,
          name: c.name,
          guildName: guild.name,
          createdAt: (c as any).createdAt
        }));
      tickets.push(...guildTickets);
    });
    
    res.json(tickets.sort((a, b) => b.createdAt - a.createdAt));
  });

  app.get('/api/logs', (req, res) => {
    res.json(ticketLogs);
  });

  app.get('/api/guilds', (req, res) => {
    if (!client.isReady()) return res.status(503).json({ error: 'Bot is not ready' });
    const guilds = client.guilds.cache.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL()
    }));
    res.json(guilds);
  });

  app.get('/api/channels/:guildId', async (req, res) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const channels = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText)
      .map(c => ({
        id: c.id,
        name: c.name
      }));
    res.json(channels);
  });

  app.post('/api/setup', async (req, res) => {
    const { channelId, title, description, categories: customCategories } = req.body;
    const channel = client.channels.cache.get(channelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      return res.status(400).json({ error: 'Invalid text channel' });
    }

    try {
      // Update global map for future interactions
      if (customCategories) {
        customCategories.forEach((cat: any) => {
          categoryMap[cat.value] = cat.label;
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(title || '🎫 ʀᴇᴀʟᴢʏᴠᴏᴋ ꜱᴜᴘᴘᴏʀᴛ')
        .setDescription(description || 'Need help? Select a category from the dropdown menu below to open a support ticket. Our staff will be with you shortly!')
        .setColor('#5865F2')
        .setThumbnail(client.user?.displayAvatarURL() || null);

      const select = new StringSelectMenuBuilder()
        .setCustomId('ticket_category')
        .setPlaceholder('Select a ticket category...')
        .addOptions(
          (customCategories || [
            { label: 'General Support', value: 'support', description: 'General questions or help', emoji: '🛠️' },
            { label: 'User Report', value: 'report', description: 'Report a user for any reason', emoji: '🛡️' },
            { label: 'Partnerships', value: 'partner', description: 'Inquiries about partnerships', emoji: '🤝' },
            { label: 'Army Inquiries', value: 'army', description: 'Army related questions', emoji: '🏆' }
          ]).map((cat: any) => 
            new StringSelectMenuOptionBuilder()
              .setLabel(cat.label)
              .setValue(cat.value)
              .setDescription(cat.description)
              .setEmoji(cat.emoji)
          )
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

      await channel.send({ embeds: [embed], components: [row] });
      res.json({ success: true });
    } catch (error) {
      console.error('Manual setup failed:', error);
      res.status(500).json({ error: 'Failed to send message to channel' });
    }
  });

  app.post('/api/permissions', (req, res) => {
    const { roles } = req.body;
    if (Array.isArray(roles)) {
      staffRoleIds = roles;
    }
    res.json({ success: true, staffRoleIds });
  });

  app.get('/api/permissions', (req, res) => {
    res.json({ staffRoleIds });
  });

  app.get('/api/form_config', (req, res) => {
    res.json(customFormConfig);
  });

  app.post('/api/save_form', (req, res) => {
    const { title, description, buttonLabel, questions } = req.body;
    try {
      customFormConfig = {
        title: title || 'Application Form',
        description: description || 'Click below to apply.',
        buttonLabel: buttonLabel || 'Apply Now',
        questions: Array.isArray(questions) && questions.length > 0 ? questions : ['Why do you want to apply?']
      };
      fs.writeFileSync(configPath, JSON.stringify(customFormConfig, null, 2));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save form config' });
    }
  });

  app.post('/api/setup_form', async (req, res) => {
    const { channelId, title, description, buttonLabel, questions } = req.body;
    const channel = client.channels.cache.get(channelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      return res.status(400).json({ error: 'Invalid text channel' });
    }

    try {
      customFormConfig = {
        title: title || 'Application Form',
        description: description || 'Click below to apply.',
        buttonLabel: buttonLabel || 'Apply Now',
        questions: Array.isArray(questions) && questions.length > 0 ? questions : ['Why do you want to apply?']
      };
      fs.writeFileSync(configPath, JSON.stringify(customFormConfig, null, 2));

      const embed = new EmbedBuilder()
        .setTitle(customFormConfig.title)
        .setDescription(customFormConfig.description)
        .setColor('#9B59B6')
        .setThumbnail(client.user?.displayAvatarURL() || null);

      const button = new ButtonBuilder()
        .setCustomId('open_custom_form')
        .setLabel(customFormConfig.buttonLabel)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝');

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      await channel.send({ embeds: [embed], components: [row] });
      res.json({ success: true });
    } catch (error) {
      console.error('Form manual setup failed:', error);
      res.status(500).json({ error: 'Failed to send msg' });
    }
  });

  app.post('/api/send', async (req, res) => {
    const { channelId, content } = req.body;
    const channel = client.channels.cache.get(channelId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      return res.status(400).json({ error: 'Invalid text channel' });
    }

    try {
      await channel.send({ content });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // --- Vite & Static Assets ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌍 Dashboard running on http://localhost:${PORT}`);
    
    // Self-ping to keep Render free tier alive
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
    if (RENDER_URL) {
      console.log(`📡 Self-ping active: ${RENDER_URL}/ping`);
      setInterval(async () => {
        try {
          const res = await fetch(`${RENDER_URL}/ping`);
          console.log(`Pinged ${RENDER_URL}/ping: ${res.statusText}`);
        } catch (err) {
          console.error('Self-ping failed:', err);
        }
      }, 10 * 60 * 1000); // Ping every 10 minutes
    }
  });
}

startServer();
