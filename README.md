# Bahasa Kitani Dictionary
### Complete Beginner Setup Guide

---

## 📁 Your Project Folder Structure

```
bahasa-kitani/
│
├── index.html          ← The main public website
├── README.md           ← This guide
│
├── data/
│   └── tutong.js       ← ALL your words live here. Edit this to add words.
│
├── admin/
│   ├── index.html      ← Admin: Add new words (run on your computer only)
│   └── feedback.html   ← Admin: Manage feedback from visitors
│
└── images/             ← Put any word images here (for future use)
```

---

## PART 1 — Running the Website on Your Computer (for testing)

Before you put the website online, you should test it locally.

### Step 1: Install VS Code (free code editor)
1. Go to https://code.visualstudio.com
2. Download and install it (it's free)

### Step 2: Install the "Live Server" extension
1. Open VS Code
2. Click the Extensions icon on the left sidebar (it looks like 4 squares)
3. Search for **Live Server** by Ritwick Dey
4. Click Install

### Step 3: Open your project
1. In VS Code, click **File → Open Folder**
2. Select your `bahasa-kitani` folder
3. You'll see all your files on the left

### Step 4: Launch the website
1. Right-click on `index.html` in the left panel
2. Click **"Open with Live Server"**
3. Your browser will open and show the website at `http://127.0.0.1:5500`

✅ Your website is now running locally! Any changes you save will instantly refresh.

---

## PART 2 — Adding a New Word

### The easy way (Admin Dashboard):
1. Open VS Code and start Live Server (see Part 1)
2. Go to `http://127.0.0.1:5500/admin/` in your browser
3. Fill in the form: Tutong word, Malay, English, Category
4. Click **Generate Code**
5. Click **Copy**
6. Open `data/tutong.js` in VS Code
7. Scroll to the very bottom of the file
8. Find the line that says `];` all by itself at the end
9. Click just BEFORE that line
10. Paste the copied code
11. Save the file (Ctrl+S on Windows, Cmd+S on Mac)

### The manual way (if you're comfortable):
Open `data/tutong.js` and copy-paste an existing entry, then change the values.
Example:
```js
{ id:153, tutong:"Lawu", malay:"Panas", english:"Hot", cat:"Expressions", notation:"", note:"" },
```

---

## PART 3 — Hosting on GitHub Pages (Free)

### Step 1: Create a GitHub account
1. Go to https://github.com
2. Click **Sign Up** and create a free account

### Step 2: Create a new repository
1. Click the **+** button at the top right → **New repository**
2. Name it exactly: `bahasa-kitani` (or whatever you like)
3. Make sure it's set to **Public**
4. Click **Create repository**

### Step 3: Upload your files
1. On the repository page, click **uploading an existing file**
2. Drag and drop your ENTIRE `bahasa-kitani` folder contents
   (drag index.html, the data folder, admin folder, images folder)
3. Scroll down, write a commit message like "first upload"
4. Click **Commit changes**

### Step 4: Enable GitHub Pages
1. Click **Settings** tab (top of your repository)
2. Scroll down to **Pages** in the left sidebar
3. Under **Source**, select **Deploy from a branch**
4. Under **Branch**, select **main**, folder **/ (root)**
5. Click **Save**
6. Wait 2–3 minutes, then your site will be live at:
   `https://YOUR-USERNAME.github.io/bahasa-kitani/`

---

## PART 4 — Connecting Your Namecheap Domain

Your domain: **bahasa-kitani.xyz**

### Step 1: Add your domain to GitHub
1. Go to your repository **Settings → Pages**
2. Under **Custom domain**, type: `bahasa-kitani.xyz`
3. Click **Save**
4. GitHub will create a file called `CNAME` automatically

### Step 2: Configure Namecheap DNS
1. Log in to **Namecheap** → go to your domain dashboard
2. Click **Manage** next to `bahasa-kitani.xyz`
3. Click the **Advanced DNS** tab
4. Delete any existing A records or CNAME records for `@` and `www`
5. Add these 4 **A Records**:

| Type | Host | Value            | TTL  |
|------|------|------------------|------|
| A    | @    | 185.199.108.153  | Auto |
| A    | @    | 185.199.109.153  | Auto |
| A    | @    | 185.199.110.153  | Auto |
| A    | @    | 185.199.111.153  | Auto |

6. Add this **CNAME Record**:

| Type  | Host | Value                                    | TTL  |
|-------|------|------------------------------------------|------|
| CNAME | www  | YOUR-USERNAME.github.io                 | Auto |

7. Click **Save All Changes**

### Step 3: Wait and verify
- DNS changes can take 30 minutes to 24 hours to work
- Once done, `https://bahasa-kitani.xyz` will show your dictionary!
- GitHub Pages will also give you a free SSL certificate (the padlock 🔒)

---

## PART 5 — Updating the Website After First Upload

Every time you add words or make changes:

1. Make your changes in VS Code (add words to `data/tutong.js`)
2. Test locally with Live Server
3. Go to your GitHub repository
4. Navigate to the file you changed (e.g. `data/tutong.js`)
5. Click the **pencil icon** (Edit) at the top right of the file view
6. Delete the old content, paste your updated content
7. Click **Commit changes**
8. Your website updates automatically within 1–2 minutes

### OR use GitHub Desktop (easier drag-and-drop):
1. Download GitHub Desktop: https://desktop.github.com
2. Sign in and clone your repository
3. Make changes to files on your computer
4. GitHub Desktop shows what changed
5. Write a message and click **Commit to main**
6. Click **Push origin** — done!

---

## PART 6 — Importing Words from Airtable

Your Airtable source: https://airtable.com/apps1QhmGfuqnzIse/shrAsz5T0meEsUzLP/tblhVkpwcAQRfzq2a

### How to export Airtable data:
1. Open the Airtable base
2. Click the **Grid view**
3. Click **...** (three dots) at the top right → **Download CSV**
4. You'll get a `.csv` file with all the words
5. Open it in Excel or Google Sheets
6. You can then format the data to match our `tutong.js` format

### Converting CSV to tutong.js entries:
Once you have the CSV, message the AI assistant with it and ask:
> "Please convert this Airtable CSV data into tutong.js format entries I can paste into my data file"

---

## PART 7 — Keeping the Admin Dashboard Private

The `admin/` folder is accessible to anyone who knows the URL.
For now it's fine since the admin only generates code (it doesn't directly edit the site).

For extra security, you can:
- Simply not link to it from the public website (it already isn't linked publicly)
- Add a simple password using a free service like **Netlify** (if you ever switch hosts)
- Or just keep the admin folder on your computer and never upload it to GitHub

---

## Quick Reference

| Task | What to do |
|------|-----------|
| Add a word | Use `admin/index.html`, copy code, paste into `data/tutong.js` |
| Manage feedback | Use `admin/feedback.html` |
| Update live site | Edit files → commit to GitHub |
| Test locally | VS Code + Live Server |
| Domain not working | Check Namecheap DNS settings (Part 4) |

---

## Need Help?

If something isn't working, take a screenshot and describe the problem. Common issues:
- **White screen**: The browser can't find `data/tutong.js` — make sure the folder structure matches exactly
- **Domain not connecting**: DNS changes take time — wait 24 hours before worrying
- **Words not showing**: Check `data/tutong.js` for any missing commas or quotes

---

*Bahasa Kitani Dictionary — Preserving indigenous languages of Brunei Darussalam*
