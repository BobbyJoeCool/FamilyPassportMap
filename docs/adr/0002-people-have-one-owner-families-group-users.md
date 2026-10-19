# Every Person has one Owner; a Family groups Users, not People

When login arrived we chose to have Users own People directly rather than create a Family (household) record that owns them. Every Person keeps exactly one Owner even after Users Join a Family. A Family is only a group of Users whose members may manage each other's People. Leaving a Family takes your own People with you, which has a clear answer only because ownership never moves to the group.

Each User has one Primary Person (the Person who is them). Giving a family member their own account isn't a separate feature: they sign up, Join, and Claim their existing Person, which makes them its Owner (with the current Owner's approval).

Every "can this User view / edit this Person?" decision goes through one central check. That's what lets Link and Join arrive later without touching every route.

## Considered Options

- **Family record owns People, Users are members**: rejected. It forces invite, leave and last-member rules into the first login build, and makes "who keeps which People when someone leaves" ambiguous.
- **A Person can belong to several Users**: rejected in favor of Claim. One Owner per Person keeps visits in one place without shared ownership.
