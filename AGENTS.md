# Videos

We're going to be creating a few videos of graphical demonstrations of the varying levels of privacy preservation in the landscape today, their implementation challenges, what's doable, what's worth investing in, and where the legal landscape points us. You should create a new pnpm package in the videos folder for each scene you create. For video graphics, you may only use JointJS-rendered diagrams, with animation applied through JavaScript. There is a JointJS MCP server, and I also included 

## Video 1: What is the threat landscape?

1. What threat models apply?
  a. Users already comfortable with using Cloud Storage with 'checkbox' encryption likely will never be a paying customer (i.e. enable bucket-wide encryption with an AWS-hosted key)
  b. Our customer may not be our user - the daily users of a service might be the ones pushing their vendors to increase security.
  c. Our customer might have an adversarial relationship to our users - the daily users of a service might want to reverse engineer a clever neural network, but unfortuantely for them, the weights are encrypted.

At this point, the video screen should change to an isomorphic cloud architecture diagram view, with a standard multi-AZ VPC layout in AWS, with a single EC2 instance, inside of which is a virtual machine. There is also an inference device connected to the EC2 instance, as well as an RDS database. Outside of the Cloud, there are three separate users on their home computers. An animated, dotted line connects them to a mysterious SaaS provider block, who is then running on the Cloud, specifically that EC2 instance.

One thing is for sure, privacy must be preserved at all times between:
1. One user to user (animmate two users sending a query to their SaaS provider, the responses coming back, and leaking info about who else was using them at that point in time, and put a big red X on the screen)
2. One user to a saas-provider (animate a hacker figure by the SaaS provider as one of the users sends a query to it. The query starts out in plaintext, but right as it approaches the saas-provider, it should shuffle into gibberish, preventing inspection).
3. A saas-provider to a user (animate a user attempting to prompt inject the SaaS provider)
4. A saas-provider to a colluding mass of all their users working against them (animate all the users attempting to prompt inject the SaaS provider)

5. But that's not all. The SaaS provider has compute providers, in this case, they are running an agentic harness inside a container, on a virtual machine, in AWS, with connectivity to a Postgres database and an AI accelerator card.
(Fade away the users and zoom in on the SaaS provider's interactions with the CloudProvider)
6. A saas-provider to their orchestration layer (draw a protective locked box around the container as a query flows from the SaaS provider to the container)
7. A compute unit to its hardware (draw another box just inside the EC2 instance boundary)
8. A compute unit to its accelerator cards (show gibberish flowing from the compute unit to the accelerator card)
9. A compute unit to its storage (show gibberish flowing from the compute unit to the database).
10. And of course, all those downstream services must be privacy-perserving with respect to their own orchestration, compute, storage, networking, and hardware (show a maze of gibberish on all channels).

This achieves privacy preservation for all parties - this includes the somewhat unbelievable claim that the Cloud Provider learns nothing about the workloads their customers are running, even though they operate the hypervisor, they can't inspect the guest VM, and the guest can prove it.