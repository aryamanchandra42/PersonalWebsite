specifying it each time.
i will give you only the content: the title, the prose, any latex, and any images. you handle everything else.
specifically:

create /posts/[slug].html using /posts/template-math.html as the base. infer the slug from the title in kebab-case. do not alter my prose in any way, not spelling, not punctuation, not sentence structure. if something looks like a typo it probably isn't.
convert all math to katex. inline math gets $...$ and display math gets $$...$$. infer which is which from context: standalone equations on their own line are display, everything else is inline.
if i give you images, place them inline at the point in the prose where they are most relevant. give each a simple descriptive alt tag. size them to fit the reading column, no wider than the text measure.
infer the date from context or ask me once if there is none. infer tags from the content: Math always, then one or two from Topology, Analysis, Geometry, Combinatorics, Algebra as appropriate.
add the post to blog.html in the correct chronological position using the same entry format as existing entries. if i have marked it as a draft, add a draft class so it is hidden until i remove it.
do not touch any other file.

when i give you a post just start. do not ask clarifying questions unless something is genuinely ambiguous.