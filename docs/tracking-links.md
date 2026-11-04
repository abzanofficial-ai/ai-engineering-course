# Tagging your links (posts, ads and emails)

The analytics screen (`/admin/analytics`) shows where visitors and new learners come from. It
works without cookies. Add three tags to every link you share, so each post or ad shows up as
its own row.

| Tag            | What to put            | Examples                                                                 |
| -------------- | ---------------------- | ------------------------------------------------------------------------ |
| `utm_source`   | The site or sender     | `linkedin`, `instagram`, `meta`, `youtube`, `newsletter`, `centre-email` |
| `utm_medium`   | The type of link       | `social` (free posts), `paid` (ads), `email`, `partner`                  |
| `utm_campaign` | Your name for the push | `launch`, `founding-100`, `founders-week1`                               |

Use lower case, with dashes instead of spaces.

**Example: a LinkedIn post for the founding offer**

```
https://yourdomain.com/?utm_source=linkedin&utm_medium=social&utm_campaign=founding-100
```

**Example: a Meta ad pointing at Chapter 1**

```
https://yourdomain.com/learn/ai-engineering-handbook/1-python-for-ai-engineering?utm_source=meta&utm_medium=paid&utm_campaign=founders
```

Links without tags still count: the referring site is used where the browser sends it
(`linkedin.com`, `google` and so on). Anything else shows as `direct`.

**Reading the numbers:** "Conversion" is new learners divided by visits for that source. Compare
sources over the same period, and give a new channel at least a week before judging it.
