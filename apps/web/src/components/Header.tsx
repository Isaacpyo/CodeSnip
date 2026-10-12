import {
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  HStack,
  Link,
  Menu,
  Portal,
  Text,
} from '@chakra-ui/react';
import { Code2, Compass, Library, LogIn, LogOut, Plus } from 'lucide-react';
import { NavLink, Link as RouterLink } from 'react-router';
import { useAuth } from '../auth/context';
import { useProfile } from '../hooks/queries';
import { notify } from '../ui/notify';
import { ColorModeButton } from './ColorModeButton';

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm" px={{ base: '2', sm: '3' }}>
      <NavLink
        to={to}
        end
        aria-label={label}
        className={({ isActive }) => (isActive ? 'active' : undefined)}
      >
        {icon}
        <Box as="span" hideBelow="sm">
          {label}
        </Box>
      </NavLink>
    </Button>
  );
}

export function Header() {
  const { user, status, signOut: authSignOut } = useAuth();
  const profile = useProfile();
  const name = profile.data?.displayName || user?.email || 'You';

  const signOut = async () => {
    try {
      // On /app pages RequireAuth then sends the user home; public pages stay put.
      await authSignOut();
    } catch (error) {
      notify.error(error, 'Couldn’t sign out');
    }
  };

  return (
    <Box as="header" borderBottomWidth="1px" bg="bg" position="sticky" top="0" zIndex="sticky">
      <Container maxW="7xl" py="2" px={{ base: '3', md: '6' }}>
        <HStack justify="space-between" gap="2">
          <HStack gap={{ base: '1', md: '4' }} minWidth="0">
            <Link
              asChild
              fontWeight="bold"
              fontSize="lg"
              _hover={{ textDecoration: 'none' }}
              me="2"
            >
              <RouterLink to={user ? '/app' : '/'} aria-label="CodeSnip home">
                <HStack gap="1.5" color="teal.fg">
                  <Code2 aria-hidden />
                  <Text as="span" color="fg" hideBelow="sm">
                    CodeSnip
                  </Text>
                </HStack>
              </RouterLink>
            </Link>
            <HStack
              as="nav"
              aria-label="Main"
              gap="0.5"
              css={{ '& a.active': { bg: 'bg.muted', fontWeight: 'semibold' } }}
            >
              {user && <NavItem to="/app" icon={<Library />} label="My snippets" />}
              <NavItem to="/explore" icon={<Compass />} label="Explore" />
            </HStack>
          </HStack>

          <HStack gap="1">
            <ColorModeButton />
            {user ? (
              <>
                <Button asChild size="sm" colorPalette="teal">
                  <RouterLink to="/app/new" aria-label="New snippet">
                    <Plus />
                    <Box as="span" hideBelow="md">
                      New snippet
                    </Box>
                  </RouterLink>
                </Button>
                <Menu.Root positioning={{ placement: 'bottom-end' }}>
                  <Menu.Trigger asChild>
                    <Button variant="ghost" size="sm" px="1" aria-label="Account menu">
                      <Avatar.Root size="xs" colorPalette="teal">
                        <Avatar.Fallback name={name} />
                        {profile.data?.avatarUrl && (
                          <Avatar.Image src={profile.data.avatarUrl} alt="" />
                        )}
                      </Avatar.Root>
                    </Button>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content minW="56">
                        <Box px="2" py="1.5">
                          <Text fontWeight="medium" truncate>
                            {name}
                          </Text>
                          {user.email && (
                            <Text fontSize="xs" color="fg.muted" truncate>
                              {user.email}
                            </Text>
                          )}
                          {profile.data?.isDemo && (
                            <Badge mt="1" colorPalette="orange" size="sm">
                              Shared demo account
                            </Badge>
                          )}
                        </Box>
                        <Menu.Separator />
                        <Menu.Item value="sign-out" onSelect={() => void signOut()}>
                          <LogOut size={16} /> Sign out
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              </>
            ) : status === 'signed-out' ? (
              <Button asChild size="sm" variant="outline">
                <RouterLink to="/login">
                  <LogIn /> Sign in
                </RouterLink>
              </Button>
            ) : null}
          </HStack>
        </HStack>
      </Container>
    </Box>
  );
}
