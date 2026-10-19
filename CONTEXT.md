# FamilyPassportMap

A web app for tracking which US states and countries each member of a family has visited, shown on interactive maps.

## Language

### Accounts

**User**:
Someone who signs in to the app. A User owns their People and sees only those.
_Avoid_: Account, member, login

**Owner**:
The User a Person belongs to. Every Person has exactly one Owner, even when the Owner is Joined with other Users.
_Avoid_: Creator, admin

**Link**:
A two-way, view-only connection between two Users: each sees the other's People and maps but can't change them. Either User can remove it.
_Avoid_: Share, follow, friend

**Join**:
Joining makes a User a member of a Family, where every member can manage every member's People. Someone who leaves takes the People they own.
_Avoid_: Merge, co-manage, family link

**Family**:
A group of Users who have Joined. It has a name its members can edit. A Family groups Users; it doesn't own People (each Person still has one Owner).
_Avoid_: Household, group

**Claim**:
A User making an existing Person their Primary Person. They become its Owner, any visits on their old Primary Person are merged in, and the old one is deleted. Claiming a Person someone else owns needs that Owner's approval. Giving a family member their own account means they sign up, Join, and Claim their Person.
_Avoid_: Hand off, convert, promote, "make an account from"

### People

**Person**:
Someone whose travels are tracked. A Person doesn't sign in; a User does. Each Person is its own record, even when it stands for a User.
_Avoid_: Family member, traveler, profile

**Primary Person**:
The Person who is the User themselves. Every User has exactly one, created automatically when they first sign in. It can be replaced but never deleted on its own; it goes only when the account is deleted.
_Avoid_: Me, self, profile
