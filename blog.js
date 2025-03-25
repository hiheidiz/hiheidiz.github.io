document.addEventListener('DOMContentLoaded', () => {
    // Load header dynamically
    fetch("header.html")
        .then(response => response.text())
        .then(data => {
            document.getElementById("header-placeholder").innerHTML = data;
        })
        .catch(error => console.error("Error loading header:", error));

    // Load blog posts
    loadBlogPosts();
});

async function loadBlogPosts() {
    const postsContainer = document.getElementById('blog-posts');
    
    try {
        const metadataResponse = await fetch('posts.json');
        
        if (!metadataResponse.ok) {
            throw new Error(`HTTP error! status: ${metadataResponse.status}`);
        }
        
        const blogPosts = await metadataResponse.json();
        
        // Sort posts by date (most recent first)
        blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Clear any existing content
        postsContainer.innerHTML = '';
        
        // Create and append blog post elements
        for (const post of blogPosts) {
            try {
                const postContent = await fetch(`posts/${post.filename}`)
                    .then(res => {
                        if (!res.ok) {
                            throw new Error(`Failed to fetch post: ${post.filename}`);
                        }
                        return res.text();
                    });
                
                const postElement = document.createElement('div');
                postElement.classList.add('blog-post');
                
                postElement.innerHTML = `
                    <h2>${post.title}</h2>
                    <p class="post-date">${post.date}</p>
                    <div class="blog-post-content">${postContent}</div>
                    <a href="#" class="read-more">Read More</a>
                `;
                
                postsContainer.appendChild(postElement);
            } catch (postError) {
                console.error(`Error loading post ${post.filename}:`, postError);
            }
        }
        
        // If no posts were loaded, show a message
        if (postsContainer.children.length === 0) {
            postsContainer.innerHTML = '<p>No blog posts found.</p>';
        }
    } catch (error) {
        console.error('Critical error loading blog posts:', error);
        postsContainer.innerHTML = `
            <p>Unable to load blog posts. 
            Please check console for details.</p>
        `;
    }
}